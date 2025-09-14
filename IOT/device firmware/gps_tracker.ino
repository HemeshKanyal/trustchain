#include <Arduino.h>
#include <TinyGPSPlus.h>

TinyGPSPlus gps;

void setup() {
  Serial.begin(9600);
}

void loop() {
  // Simulated GPS (random Indian coordinates)
  float lat = 19.0 + random(-500, 500) / 100.0; 
  float lon = 72.0 + random(-500, 500) / 100.0;

  Serial.print("{\"gps\":{\"lat\":");
  Serial.print(lat, 6);
  Serial.print(",\"lon\":");
  Serial.print(lon, 6);
  Serial.println("}}");

  delay(3000);
}
