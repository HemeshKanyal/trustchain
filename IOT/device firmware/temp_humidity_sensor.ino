#include <Arduino.h>
#include "DHT.h"

#define DHTPIN 4       // GPIO4 (D2 pin on NodeMCU / ESP32)
#define DHTTYPE DHT22  // use DHT11 if you want cheaper sensor

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("{\"error\":\"Failed to read from DHT sensor\"}");
  } else {
    // Unified JSON
    Serial.print("{\"temperature\":");
    Serial.print(temperature);
    Serial.print(",\"humidity\":");
    Serial.print(humidity);
    Serial.println("}");
  }

  delay(3000); // every 3 sec
}
