#pragma once
// secp256k1 Ethereum keys and signatures on ESP32, built on the mbedTLS bundled with the framework.
#include <stddef.h>
#include <stdint.h>

struct EthKey {
  uint8_t priv[32];
  uint8_t pub[64];  // uncompressed X || Y
  uint8_t address[20];
};

namespace ethsig {

/// Fresh key from the ESP32 hardware RNG (call after WiFi/BT start for full entropy).
bool generateKey(EthKey &key);

/// Derive public key and address from `key.priv`.
bool deriveKey(EthKey &key);

/// Sign a 32-byte digest. Output r(32) || s(32) || v(1), v in {27, 28}, low-s normalised
/// (accepted by OpenZeppelin ECDSA.recover / ecrecover).
bool sign(const EthKey &key, const uint8_t digest[32], uint8_t sig[65]);

}  // namespace ethsig
