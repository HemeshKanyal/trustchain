// Crypto check: derives a known key's address and signs random digests. Verified host-side with cast.
#include <Arduino.h>
#include <esp_random.h>
#include "eth_signer.h"
#include "eip712_report.h"

void setup() {
  Serial.begin(115200);
  delay(1500);
  EthKey key;
  fromHex("92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", key.priv, 32);  // anvil #6
  char hex[131];
  bool ok = ethsig::deriveKey(key);
  toHex(key.address, 20, hex);
  Serial.printf("ADDR %d 0x%s\n", ok, hex);
  for (int i = 0; i < 20; i++) {
    uint8_t digest[32], sig[65];
    esp_fill_random(digest, 32);
    uint32_t t0 = micros();
    bool s = ethsig::sign(key, digest, sig);
    uint32_t dt = micros() - t0;
    toHex(digest, 32, hex);
    Serial.printf("SIG %d %lu 0x%s ", s, (unsigned long)dt, hex);
    toHex(sig, 65, hex);
    Serial.printf("0x%s\n", hex);
  }
  Serial.println("DONE");
}

void loop() { delay(1000); }
