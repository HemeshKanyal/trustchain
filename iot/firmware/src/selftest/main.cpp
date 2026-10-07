// Wiring self-test: open the serial monitor at 115200 baud.
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include "../pins.h"

MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
DHT dht(PIN_DHT, DHT22);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

static void checkRfidChip() {
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[RFID] chip version 0x%02X -> %s\n", v,
                (v == 0x91 || v == 0x92 || v == 0x88 || v == 0xB2) ? "OK"
                : (v == 0x00 || v == 0xFF) ? "NOT FOUND - check SDA/SCK/MOSI/MISO/3.3V"
                                           : "unknown clone (may still work)");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== TrustChain smart-box self-test ===");

  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_TAMPER, INPUT_PULLUP);

  SPI.begin();
  rfid.PCD_Init();
  checkRfidChip();

  dht.begin();
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println("Tap an RFID card/tag any time. GPS fix can take 1-5 min near a window.\n");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("[RFID] card UID: ");
    for (byte i = 0; i < rfid.uid.size; i++) Serial.printf("%02X", rfid.uid.uidByte[i]);
    Serial.println();
    rfid.PICC_HaltA();
  }

  static uint32_t last = 0;
  if (millis() - last < 2000) return;
  last = millis();
  digitalWrite(PIN_LED, !digitalRead(PIN_LED));

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) Serial.println("[DHT22] no reading - check DATA->D4, VCC->3V3, GND");
  else Serial.printf("[DHT22] %.1f C  %.1f %%RH\n", t, h);

  if (gps.charsProcessed() < 10) {
    Serial.println("[GPS] no data - check GPS TX->RX2 (GPIO16), VCC->VIN, GND");
  } else if (gps.location.isValid()) {
    Serial.printf("[GPS] fix: %.6f, %.6f  sats=%u\n", gps.location.lat(), gps.location.lng(),
                  gps.satellites.value());
  } else {
    Serial.printf("[GPS] receiving data, waiting for fix (sats=%u)\n", gps.satellites.value());
  }

  Serial.printf("[TAMPER] lid %s\n", digitalRead(PIN_TAMPER) == LOW ? "CLOSED" : "OPEN");
  Serial.println("---");
}
