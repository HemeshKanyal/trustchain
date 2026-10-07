// GPS diagnostic: raw NMEA sample + parsed status every 5 s.
#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "../pins.h"

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
TinyGPSCustom gsvInView(gps, "GPGSV", 3);  // satellites in view
TinyGPSCustom gsvSnr1(gps, "GPGSV", 7);    // SNR of first satellite in each GSV sentence
TinyGPSCustom gsvSnr2(gps, "GPGSV", 11);
TinyGPSCustom gsvSnr3(gps, "GPGSV", 15);
TinyGPSCustom gsvSnr4(gps, "GPGSV", 19);
TinyGPSCustom rmcStatus(gps, "GPRMC", 2);  // A = valid, V = no fix

static int maxSnr = 0;
static String line;
static uint8_t rawToShow = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println("\n=== GPS diagnostic ===");
}

void loop() {
  while (gpsSerial.available()) {
    char c = gpsSerial.read();
    gps.encode(c);
    if (c == '\n') {
      if (rawToShow) {
        Serial.print("  NMEA ");
        Serial.println(line);
        rawToShow--;
      }
      line = "";
    } else if (c != '\r' && line.length() < 120) {
      line += c;
    }
  }
  for (TinyGPSCustom *f : {&gsvSnr1, &gsvSnr2, &gsvSnr3, &gsvSnr4}) {
    if (f->isUpdated()) maxSnr = max(maxSnr, atoi(f->value()));
  }

  static uint32_t last = 0;
  if (millis() - last < 5000) return;
  last = millis();
  Serial.printf("[GPS] t=%3lus chars=%lu ok=%lu badChecksum=%lu | rmc=%s inView=%s used=%u bestSNR=%ddB hdop=%.1f | ",
                millis() / 1000, gps.charsProcessed(), gps.passedChecksum(), gps.failedChecksum(),
                rmcStatus.isValid() ? rmcStatus.value() : "?", gsvInView.isValid() ? gsvInView.value() : "?",
                gps.satellites.value(), maxSnr, gps.hdop.isValid() ? gps.hdop.hdop() : 99.9);
  if (gps.time.isValid() && gps.date.year() > 2000)
    Serial.printf("utc=%04d-%02d-%02d %02d:%02d:%02d | ", gps.date.year(), gps.date.month(), gps.date.day(),
                  gps.time.hour(), gps.time.minute(), gps.time.second());
  else
    Serial.print("utc=none | ");
  if (gps.location.isValid())
    Serial.printf("FIX %.6f, %.6f alt=%.0fm\n", gps.location.lat(), gps.location.lng(), gps.altitude.meters());
  else
    Serial.println("no fix");
  maxSnr = 0;
  if (millis() < 12000 || millis() % 60000 < 5000) rawToShow = 6;  // raw sample at start and once a minute
}
