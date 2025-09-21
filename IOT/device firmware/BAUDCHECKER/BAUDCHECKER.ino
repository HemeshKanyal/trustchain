#include <HardwareSerial.h>

HardwareSerial SerialGPS(1);

// Common baudrates for GPS modules
int baudRates[] = {4800, 9600, 19200, 38400, 57600, 115200};
int numRates = sizeof(baudRates) / sizeof(baudRates[0]);

void setup() {
  Serial.begin(115200);
  Serial.println("🔎 Starting GPS Baudrate Scanner...");

  // Test each baudrate for 5 seconds
  for (int i = 0; i < numRates; i++) {
    int baud = baudRates[i];
    Serial.print("\n⏳ Testing baudrate: ");
    Serial.println(baud);

    SerialGPS.begin(baud, SERIAL_8N1, 16, 17);
    unsigned long start = millis();
    bool found = false;

    while (millis() - start < 5000) {
      while (SerialGPS.available()) {
        char c = SerialGPS.read();
        Serial.write(c);

        // If we see $GP... it’s valid NMEA
        if (c == '$') {
          found = true;
        }
      }
    }

    if (found) {
      Serial.print("\n✅ GPS is talking at ");
      Serial.print(baud);
      Serial.println(" baud!");
      break; // stop scanning
    } else {
      Serial.println("❌ No valid NMEA at this baud.");
    }
  }
}

void loop() {
  // Nothing here, everything is done in setup
}
