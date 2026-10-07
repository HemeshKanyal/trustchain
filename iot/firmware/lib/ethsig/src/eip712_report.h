#pragma once
// EIP-712 encoding of ColdChainMonitor.Report. Must match blockchain/src/ColdChainMonitor.sol exactly.
#include <stddef.h>
#include <stdint.h>

struct TelemetryReport {
  uint64_t shipmentId;  // uint256 on-chain; ids fit comfortably in 64 bits
  uint64_t windowStart;
  uint64_t windowEnd;
  uint32_t readings;
  int16_t minTempX10;
  int16_t maxTempX10;
  uint16_t maxHumidityX10;
  int32_t latE6;
  int32_t lonE6;
  bool tamper;
  uint8_t dataHash[32];
  uint64_t seq;
};

namespace eip712 {

constexpr const char *REPORT_TYPE =
    "Report(uint256 shipmentId,uint64 windowStart,uint64 windowEnd,uint32 readings,int16 minTempX10,"
    "int16 maxTempX10,uint16 maxHumidityX10,int32 latE6,int32 lonE6,bool tamper,bytes32 dataHash,uint64 seq)";

void domainSeparator(uint64_t chainId, const uint8_t verifyingContract[20], uint8_t out[32]);
void reportDigest(const uint8_t domainSep[32], const TelemetryReport &r, uint8_t out[32]);

}  // namespace eip712

// Hex helpers (lowercase, no 0x prefix on output).
void toHex(const uint8_t *data, size_t len, char *out);
bool fromHex(const char *hex, uint8_t *out, size_t outLen);
