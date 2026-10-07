#include "eip712_report.h"

#include <string.h>

#include "keccak256.h"

namespace {

void wordUint(uint8_t w[32], uint64_t v) {
  memset(w, 0, 32);
  for (int i = 0; i < 8; i++) w[31 - i] = (uint8_t)(v >> (8 * i));
}

void wordInt(uint8_t w[32], int64_t v) {
  memset(w, v < 0 ? 0xFF : 0x00, 32);  // two's complement sign extension to 256 bits
  uint64_t u = (uint64_t)v;
  for (int i = 0; i < 8; i++) w[31 - i] = (uint8_t)(u >> (8 * i));
}

void hashStr(const char *s, uint8_t out[32]) { keccak256((const uint8_t *)s, strlen(s), out); }

}  // namespace

namespace eip712 {

void domainSeparator(uint64_t chainId, const uint8_t verifyingContract[20], uint8_t out[32]) {
  uint8_t w[32];
  keccak256_ctx c;
  keccak256_init(&c);
  hashStr("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)", w);
  keccak256_update(&c, w, 32);
  hashStr("TrustChainColdChain", w);
  keccak256_update(&c, w, 32);
  hashStr("1", w);
  keccak256_update(&c, w, 32);
  wordUint(w, chainId);
  keccak256_update(&c, w, 32);
  memset(w, 0, 12);
  memcpy(w + 12, verifyingContract, 20);
  keccak256_update(&c, w, 32);
  keccak256_final(&c, out);
}

void reportDigest(const uint8_t domainSep[32], const TelemetryReport &r, uint8_t out[32]) {
  uint8_t w[32];
  uint8_t structHash[32];
  keccak256_ctx c;
  keccak256_init(&c);
  hashStr(REPORT_TYPE, w);
  keccak256_update(&c, w, 32);
  wordUint(w, r.shipmentId);
  keccak256_update(&c, w, 32);
  wordUint(w, r.windowStart);
  keccak256_update(&c, w, 32);
  wordUint(w, r.windowEnd);
  keccak256_update(&c, w, 32);
  wordUint(w, r.readings);
  keccak256_update(&c, w, 32);
  wordInt(w, r.minTempX10);
  keccak256_update(&c, w, 32);
  wordInt(w, r.maxTempX10);
  keccak256_update(&c, w, 32);
  wordUint(w, r.maxHumidityX10);
  keccak256_update(&c, w, 32);
  wordInt(w, r.latE6);
  keccak256_update(&c, w, 32);
  wordInt(w, r.lonE6);
  keccak256_update(&c, w, 32);
  wordUint(w, r.tamper ? 1 : 0);
  keccak256_update(&c, w, 32);
  keccak256_update(&c, r.dataHash, 32);
  wordUint(w, r.seq);
  keccak256_update(&c, w, 32);
  keccak256_final(&c, structHash);

  keccak256_init(&c);
  const uint8_t prefix[2] = {0x19, 0x01};
  keccak256_update(&c, prefix, 2);
  keccak256_update(&c, domainSep, 32);
  keccak256_update(&c, structHash, 32);
  keccak256_final(&c, out);
}

}  // namespace eip712

void toHex(const uint8_t *data, size_t len, char *out) {
  static const char *H = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out[2 * i] = H[data[i] >> 4];
    out[2 * i + 1] = H[data[i] & 0xF];
  }
  out[2 * len] = 0;
}

static int nibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

bool fromHex(const char *hex, uint8_t *out, size_t outLen) {
  if (hex[0] == '0' && (hex[1] == 'x' || hex[1] == 'X')) hex += 2;
  if (strlen(hex) != outLen * 2) return false;
  for (size_t i = 0; i < outLen; i++) {
    int hi = nibble(hex[2 * i]), lo = nibble(hex[2 * i + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = (uint8_t)((hi << 4) | lo);
  }
  return true;
}
