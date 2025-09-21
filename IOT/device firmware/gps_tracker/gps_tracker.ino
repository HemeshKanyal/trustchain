#include <HardwareSerial.h>

HardwareSerial SerialGPS(1);

void setup() {
  Serial.begin(115200);                    // USB serial to PC
  SerialGPS.begin(9600, SERIAL_8N1, 16, 17); // GPS module
}

void loop() {
  while (SerialGPS.available()) {
    Serial.write(SerialGPS.read());   // forward GPS → PC
  }
  while (Serial.available()) {
    SerialGPS.write(Serial.read());   // forward PC → GPS (for config)
  }
}
