#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include "DHT.h"
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ---------------- RFID ----------------
#define SS_PIN 5      // SDA pin
#define RST_PIN 22    // RST pin
MFRC522 mfrc522(SS_PIN, RST_PIN);

// ---------------- DHT22 ----------------
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ---------------- GPS ----------------
TinyGPSPlus gps;
HardwareSerial SerialGPS(1); // use UART1 for GPS (GPIO16=RX, GPIO17=TX)

// ---------------- DEBUG FLAG ----------------
#define DEBUG_GPS_RAW true   // set to false to disable raw NMEA debug

// ---------------- Setup ----------------
void setup() {
  Serial.begin(115200);           // Serial to PC
  SPI.begin();
  mfrc522.PCD_Init();

  dht.begin();
  SerialGPS.begin(9600, SERIAL_8N1, 16, 17); // GPS RX=16, TX=17

  Serial.println("🚀 Unified IoT Firmware Started");
}

// ---------------- Loop ----------------
void loop() {
  String rfidTag = "";
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // --- RFID ---
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      rfidTag += String(mfrc522.uid.uidByte[i], HEX);
    }
    mfrc522.PICC_HaltA();
  }

  // --- GPS ---
  double latitude = 0.0, longitude = 0.0;
  while (SerialGPS.available() > 0) {
    char c = SerialGPS.read();
    if (DEBUG_GPS_RAW) Serial.write(c);  // <-- print raw NMEA if enabled
    if (gps.encode(c)) {
      if (gps.location.isValid()) {
        latitude = gps.location.lat();
        longitude = gps.location.lng();
      }
    }
  }

  // --- Output JSON ---
  Serial.print("{\"rfid_tag\":\"");
  Serial.print(rfidTag);
  Serial.print("\",\"temperature\":");
  Serial.print(isnan(temperature) ? -999 : temperature);
  Serial.print(",\"humidity\":");
  Serial.print(isnan(humidity) ? -999 : humidity);
  Serial.print(",\"gps\":{\"lat\":");
  Serial.print(latitude, 6);
  Serial.print(",\"lon\":");
  Serial.print(longitude, 6);
  Serial.println("}}");

  delay(50); // every 2 sec
}
