#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Ethereum Keccak-256 (original Keccak padding 0x01, NOT NIST SHA3-256).
typedef struct {
  uint64_t state[25];
  size_t offset;
} keccak256_ctx;

void keccak256_init(keccak256_ctx *ctx);
void keccak256_update(keccak256_ctx *ctx, const uint8_t *data, size_t len);
void keccak256_final(keccak256_ctx *ctx, uint8_t out[32]);
void keccak256(const uint8_t *data, size_t len, uint8_t out[32]);

#ifdef __cplusplus
}
#endif
