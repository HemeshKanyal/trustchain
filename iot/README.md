# TrustChain smart box (ESP32)

Firmware for the tracker box: ESP32 DevKit V1 (30-pin) + RC522 RFID + DHT22 + NEO-6M GPS + lid switch.

## How it works

1. On first boot the ESP32 generates its own secp256k1 key from the hardware RNG and stores it in flash. The key never leaves the device. It prints its **device address**.
2. An admin registers that address in `ColdChainMonitor`. Whoever ships a batch assigns the device to the shipment.
3. The device polls the backend (`/api/devices/<address>/config`) to learn its shipment, then samples every `sampleSeconds`. Every `windowSeconds` it builds a report (min/max temperature, max humidity, last GPS fix, tamper flag, and a hash of all raw samples and RFID scans), signs it with EIP-712 and POSTs it to the backend.
4. The backend checks the raw samples against the signed hash and summary, then relays the report on-chain. A breach quarantines the batch automatically.

The on-board LED shows the state:
- fast blink: no WiFi
- slow blink: idle, no shipment assigned
- short blip every 2 s: monitoring
- solid: breach or lid opened during this shipment

## Wiring

| Module | Module pin → ESP32 |
|---|---|
| RC522 (3.3V only) | SDA→D5, SCK→D18, MOSI→D23, MISO→D19, RST→D22, 3.3V→3V3, GND→GND |
| DHT22 | + → 3V3, OUT → D4, − → GND |
| GY-GPS6MV2 | VCC→VIN, GND→GND, TX→RX2 (GPIO16), RX→TX2 (GPIO17) |
| Lid switch | D27 ↔ GND (closed lid = switch closed) |

Pin definitions live in `firmware/src/pins.h`.

## Build & flash

Uses PlatformIO (`~/.platformio/penv/bin/pio`). Your user must be in the `dialout` group.

```bash
cd iot/firmware
pio run -e selftest -t upload && pio device monitor      # wiring check

cp src/tracker/secrets.example.h src/tracker/secrets.h   # WiFi (2.4 GHz) + BACKEND_URL
pio run -e tracker -t upload && pio device monitor       # the real tracker
```

The serial monitor accepts these commands: `addr` (print device address), `status`, `config` (re-fetch config now).

`pio run -e signtest` is a crypto self-check. It signs random digests with a known key; `tools/capture_serial.py` saves the output.

## Test with real hardware on a local chain (no gas)

```bash
anvil                                   # terminal 1
backend/scripts/local-demo.sh 0x<DEVICE_ADDRESS>       # terminal 2
cd backend && cp .env.example .env                     # set RELAYER_PRIVATE_KEY (any anvil key, e.g. #8)
npm start                                              # terminal 3
```

Set `BACKEND_URL` in `secrets.h` to `http://<laptop LAN IP>:4000` (find it with `hostname -I`). The laptop and the ESP32 must be on the same WiFi.

The demo batch allows 15–30°C and ≤ 90% RH, so indoors it reads normal. To trigger a breach, hold the DHT22 in a warm hand, breathe on it (humidity), or pull the D27 wire to open the lid.

Without hardware, run the same flow with `npm run emulator -- --scenario heat` (scenarios: `normal | heat | cold | humid | lid | sensor-fault`).
