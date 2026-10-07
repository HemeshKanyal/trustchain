#pragma once
// ESP32 DevKit V1 (30-pin) pin map. Board silk labels in brackets.

// RC522 RFID (SPI, 3.3V ONLY)
#define PIN_RFID_SS   5   // [D5]  -> RC522 SDA
#define PIN_RFID_RST  22  // [D22] -> RC522 RST
// SPI bus defaults: SCK=18 [D18], MISO=19 [D19], MOSI=23 [D23]

// DHT22 temperature / humidity
#define PIN_DHT       4   // [D4]  -> DHT22 OUT/DATA

// NEO-6M GPS (UART2)
#define PIN_GPS_RX    16  // [RX2] <- GPS TX
#define PIN_GPS_TX    17  // [TX2] -> GPS RX
#define GPS_BAUD      9600

// Lid tamper switch: closed lid = switch closed = pin pulled LOW
#define PIN_TAMPER    27  // [D27] -> switch -> GND

#define PIN_LED       2   // on-board blue LED
