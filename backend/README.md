# TrustChain backend

Node 22.13+ service that:
- **ingests** signed telemetry from smart boxes, checks each report against its raw samples and signature, and stores it (SQLite via `node:sqlite`)
- **relays** reports to `ColdChainMonitor` on-chain from a gas-paying relayer wallet
- **indexes** TrustChain / ColdChainMonitor events into SQLite (shipments, custody timeline)
- **raises alerts** on breaches, quarantines and recalls. Each alert lists exactly who is affected: current holders, shipments in transit, and patients who received strips.

## Run

```bash
npm install
cp .env.example .env     # RPC_URL, DEPLOYMENT, RELAYER_PRIVATE_KEY
npm start
npm test
npm run abi              # re-export ABIs after changing contracts (runs off ../blockchain/out)
npm run emulator -- --scenario heat
```

`DEPLOYMENT` points at `../blockchain/deployments/<chainId>.json`, which the deploy script writes.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | chain, contracts, relayer, indexer progress |
| GET | `/api/devices/:address/config` | device polling: assigned shipment, storage limits, window/sample interval, server time |
| POST | `/api/telemetry` | signed report + raw samples from a device |
| GET | `/api/devices` | on-chain registered devices with their last report |
| GET | `/api/shipments/:id/telemetry` | reports, raw samples and RFID scans for a shipment |
| GET | `/api/batches/:id/timeline` | full on-chain history of a batch |
| GET | `/api/batches/:id/affected` | current holders, shipments in transit, patients |
| GET | `/api/alerts` | recent alerts |
| GET | `/api/alerts/stream` | Server-Sent Events stream of new alerts |

## Gas

Every report window is one transaction (~100k gas). On Sepolia, use `WINDOW_SECONDS=300` or more. The relayer wallet only needs test ETH, never admin rights.

## TrustChain AI (`src/ai/`)

Runs inside this service; no external AI API.

| Signal | How | Where it shows |
|---|---|---|
| Cold-chain analysis | Time-weighted **mean kinetic temperature** (ICH, ΔH = 83.144 kJ/mol), minutes out of range, excursions, lid openings, sensor gaps/faults | Shipment page, batch risk |
| Trip anomalies | **Isolation Forest** over all monitored trips (needs 8+) | Shipment page, batch risk |
| Packaging scans | Anonymous Verify-page scans: a sold code scanned by 3+ different people = copied QR; bursts of unknown codes = counterfeit wave; wrong-batch strips found at delivery | Batch risk, admin AI page |
| Prices | Pharmacy sale prices and buyers' reported prices vs the market median (live data, else the sample dataset) | Batch risk, compliance |
| Demand forecast | Holt-Winters with weekly seasonality and **damped trend**, auto-tuned, back-tested on the last 14 days; days of cover + reorder suggestion | Pharmacy Forecast page, manufacturer overview |
| Compliance | Rule penalties per organisation (unmonitored cold shipments, breaches, slow receipts, recalled stock held, near-expiry sales, off-market prices, wrong-batch deliveries) | Profiles, admin AI page |
| Batch risk 0–100 | Combines all of the above into a score with plain-language reasons | Verify, batch page, admin AI page |

`data/medicines.csv.csv` is a 13-day sample (1–13 April 2023, 20k sales); it is used only for reference prices.

```bash
npm test                                   # includes the AI unit tests
START_DAYS_AGO=30 ../frontend/trustchain-frontend/e2e/reset-chain.sh   # chain that starts 30 days ago
node scripts/seed-ai-demo.js               # a month of real on-chain activity (heat + lid trips, weekly sales)
node scripts/verify-ai.js '<json line printed by the seeder>'          # 27 checks against that month
```

## Showcase simulator (`sim/`)

A living network for demos: 3 manufacturers, 4 distributors, 8 pharmacies and 4 doctors in real Indian cities, plus virtual smart boxes and patients. The organisations are fictional (every licence starts with `SIM-`, and the site shows a **Simulated** badge and a banner while it runs). Everything they do is real:

- batches with random 32-byte strip secrets, hashes registered on-chain
- trucks carry smart boxes that sign EIP-712 readings with their own keys, sent through `/api/telemetry` and the relayer exactly like the ESP32
- box temperatures come from a physical model: city climate and time of day outside, reefer (5 °C) or AC van (22 °C) inside, plus random cooling failures, lid openings and sensor drop-outs
- pharmacies restock from their distributor, check one strip on delivery, and sell to Poisson-arriving customers (rx medicines go through a doctor's on-chain prescription)
- buyers scan strips on the Verify page; counterfeiters scan unregistered codes
- the regulator reviews each quarantine using the AI risk score, then releases or recalls; after a recall every holder ships its strips back

```bash
npm run sim                        # local anvil, "showcase" pace (trips of 1.5–8 min)
SIM_PRESET=live npm run sim        # Sepolia, real-time pace (trips of 45–120 min, 10-min report windows)
```

| Variable | Default | Purpose |
|---|---|---|
| `SIM_PRESET` | `showcase` | `showcase` or `live` |
| `SIM_FUNDER_KEY` | none | Sepolia only: a faucet-funded wallet that tops up the simulated wallets' gas |
| `SIM_MIN_BALANCE` / `SIM_TOP_UP` | 0.02 / 0.05 | ETH thresholds for that top-up |
| `SIM_REAL_BOXES` | none | comma-separated addresses of registered real boxes (the ESP32) the distributors may load onto trucks |
| `SIM_PORT` | 4100 | control API (localhost only); the backend proxies it as `/api/sim/*` |
| `SIM_CONTROL_TOKEN` | none | shared secret between backend and simulator, if they run on different hosts |

The simulator generates its own mnemonic (stored in `data/sim-state-<chainId>.json`, git-ignored with `data/`). On a real network the contract owner must make its regulator wallet an admin once; the simulator prints the exact `cast send` command. It never uses your admin key.

Showcase controls (admin → Simulation): reefer failure, box opened, sensor drop-out, counterfeit wave, copied QR, manufacturer recall, price dumping, pause/resume.
