#ifdef ESP_PLATFORM
#include "eth_signer.h"

#include <esp_random.h>
#include <mbedtls/ecdsa.h>
#include <mbedtls/ecp.h>
#include <string.h>

#include "keccak256.h"

namespace {

int hwRng(void *, unsigned char *out, size_t len) {
  esp_fill_random(out, len);
  return 0;
}

struct Group {
  mbedtls_ecp_group grp;
  Group() {
    mbedtls_ecp_group_init(&grp);
    mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1);
  }
  ~Group() { mbedtls_ecp_group_free(&grp); }
};

struct Mpi {
  mbedtls_mpi v;
  Mpi() { mbedtls_mpi_init(&v); }
  ~Mpi() { mbedtls_mpi_free(&v); }
  mbedtls_mpi *operator&() { return &v; }
};

struct Point {
  mbedtls_ecp_point v;
  Point() { mbedtls_ecp_point_init(&v); }
  ~Point() { mbedtls_ecp_point_free(&v); }
  mbedtls_ecp_point *operator&() { return &v; }
};

/// Does (r, s, recid) recover to `expected` for digest e? Q = r^-1 (sR - eG).
bool recoversTo(mbedtls_ecp_group *grp, mbedtls_mpi *r, mbedtls_mpi *s, mbedtls_mpi *e, int recid,
                mbedtls_ecp_point *expected) {
  Mpi alpha, beta, exp, y, rinv, u1, u2, tmp;
  Point R, Q;
  // alpha = x^3 + 7 mod p ; beta = alpha^((p+1)/4) since p ≡ 3 mod 4
  if (mbedtls_mpi_mul_mpi(&tmp, r, r) || mbedtls_mpi_mod_mpi(&tmp, &tmp, &grp->P)) return false;
  if (mbedtls_mpi_mul_mpi(&alpha, &tmp, r) || mbedtls_mpi_add_int(&alpha, &alpha, 7) ||
      mbedtls_mpi_mod_mpi(&alpha, &alpha, &grp->P))
    return false;
  if (mbedtls_mpi_add_int(&exp, &grp->P, 1) || mbedtls_mpi_shift_r(&exp, 2)) return false;
  if (mbedtls_mpi_exp_mod(&beta, &alpha, &exp, &grp->P, NULL)) return false;
  if ((int)mbedtls_mpi_get_bit(&beta, 0) == (recid & 1)) {
    if (mbedtls_mpi_copy(&y, &beta)) return false;
  } else if (mbedtls_mpi_sub_mpi(&y, &grp->P, &beta)) {
    return false;
  }
  if (mbedtls_mpi_copy(&R.v.X, r) || mbedtls_mpi_copy(&R.v.Y, &y) || mbedtls_mpi_lset(&R.v.Z, 1)) return false;
  if (mbedtls_ecp_check_pubkey(grp, &R)) return false;

  if (mbedtls_mpi_inv_mod(&rinv, r, &grp->N)) return false;
  // u1 = -e * r^-1 mod n ; u2 = s * r^-1 mod n
  if (mbedtls_mpi_mod_mpi(&tmp, e, &grp->N) || mbedtls_mpi_sub_mpi(&tmp, &grp->N, &tmp) ||
      mbedtls_mpi_mul_mpi(&u1, &tmp, &rinv) || mbedtls_mpi_mod_mpi(&u1, &u1, &grp->N))
    return false;
  if (mbedtls_mpi_mul_mpi(&u2, s, &rinv) || mbedtls_mpi_mod_mpi(&u2, &u2, &grp->N)) return false;
  if (mbedtls_ecp_muladd(grp, &Q, &u1, &grp->G, &u2, &R)) return false;
  return mbedtls_ecp_point_cmp(&Q, expected) == 0;
}

}  // namespace

namespace ethsig {

bool deriveKey(EthKey &key) {
  Group g;
  Mpi d;
  Point Q;
  if (mbedtls_mpi_read_binary(&d, key.priv, 32)) return false;
  if (mbedtls_ecp_check_privkey(&g.grp, &d)) return false;
  if (mbedtls_ecp_mul(&g.grp, &Q, &d, &g.grp.G, hwRng, NULL)) return false;
  if (mbedtls_mpi_write_binary(&Q.v.X, key.pub, 32) || mbedtls_mpi_write_binary(&Q.v.Y, key.pub + 32, 32))
    return false;
  uint8_t h[32];
  keccak256(key.pub, 64, h);
  memcpy(key.address, h + 12, 20);
  return true;
}

bool generateKey(EthKey &key) {
  for (int attempt = 0; attempt < 8; attempt++) {
    esp_fill_random(key.priv, 32);
    if (deriveKey(key)) return true;  // rejects 0 and values >= n
  }
  return false;
}

bool sign(const EthKey &key, const uint8_t digest[32], uint8_t sig[65]) {
  Group g;
  Mpi d, r, s, e, halfN;
  Point Q;
  if (mbedtls_mpi_read_binary(&d, key.priv, 32) || mbedtls_mpi_read_binary(&e, digest, 32)) return false;
  if (mbedtls_mpi_read_binary(&Q.v.X, key.pub, 32) || mbedtls_mpi_read_binary(&Q.v.Y, key.pub + 32, 32) ||
      mbedtls_mpi_lset(&Q.v.Z, 1))
    return false;

  // RFC 6979 deterministic nonce: no dependence on RNG quality at signing time.
  if (mbedtls_ecdsa_sign_det_ext(&g.grp, &r, &s, &d, digest, 32, MBEDTLS_MD_SHA256, hwRng, NULL)) return false;

  // Enforce low-s (EIP-2): s <= n/2
  if (mbedtls_mpi_copy(&halfN, &g.grp.N) || mbedtls_mpi_shift_r(&halfN, 1)) return false;
  if (mbedtls_mpi_cmp_mpi(&s, &halfN) > 0 && mbedtls_mpi_sub_mpi(&s, &g.grp.N, &s)) return false;

  int recid = -1;
  for (int i = 0; i < 2; i++) {
    if (recoversTo(&g.grp, &r, &s, &e, i, &Q)) {
      recid = i;
      break;
    }
  }
  if (recid < 0) return false;

  if (mbedtls_mpi_write_binary(&r, sig, 32) || mbedtls_mpi_write_binary(&s, sig + 32, 32)) return false;
  sig[64] = (uint8_t)(27 + recid);
  return true;
}

}  // namespace ethsig
#endif  // ESP_PLATFORM
