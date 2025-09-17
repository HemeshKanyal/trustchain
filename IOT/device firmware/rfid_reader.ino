#include <Arduino.h>

void setup() {
  Serial.begin(9600);
}

void loop() {
  // Simulated RFID tag read
  String rfidTag = "MED" + String(random(100000, 999999));

  // JSON-style output
  Serial.print("{\"rfid_tag\":\"");
  Serial.print(rfidTag);
  Serial.println("\"}");

  delay(3000); // every 3s
}
