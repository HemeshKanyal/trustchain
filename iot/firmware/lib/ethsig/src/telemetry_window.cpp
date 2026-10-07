#include "telemetry_window.h"

#include <string.h>

#include "keccak256.h"

namespace {
void be16(keccak256_ctx *c, uint16_t v) {
  uint8_t b[2] = {(uint8_t)(v >> 8), (uint8_t)v};
  keccak256_update(c, b, 2);
}
void be32(keccak256_ctx *c, uint32_t v) {
  uint8_t b[4] = {(uint8_t)(v >> 24), (uint8_t)(v >> 16), (uint8_t)(v >> 8), (uint8_t)v};
  keccak256_update(c, b, 4);
}
}  // namespace

void TelemetryWindow::reset(uint32_t windowStart) {
  start_ = windowStart;
  nSamples_ = 0;
  nRfid_ = 0;
}

bool TelemetryWindow::addSample(const Sample &s) {
  if (nSamples_ >= MAX_SAMPLES) return false;
  samples_[nSamples_++] = s;
  return true;
}

bool TelemetryWindow::addRfid(const RfidEvent &e) {
  if (nRfid_ >= MAX_RFID) return false;
  rfid_[nRfid_] = e;
  if (rfid_[nRfid_].uidLen > 10) rfid_[nRfid_].uidLen = 10;
  memset(rfid_[nRfid_].uid + rfid_[nRfid_].uidLen, 0, 10 - rfid_[nRfid_].uidLen);
  nRfid_++;
  return true;
}

void TelemetryWindow::summarize(uint32_t windowEnd, TelemetryReport &r) const {
  r.windowStart = start_;
  r.windowEnd = windowEnd;
  r.readings = (uint32_t)nSamples_;
  r.maxHumidityX10 = 0;
  r.latE6 = 0;
  r.lonE6 = 0;
  r.tamper = false;

  bool anyTemp = false;
  int16_t lo = 0, hi = 0;
  for (size_t i = 0; i < nSamples_; i++) {
    const Sample &s = samples_[i];
    if (s.tempX10 != TEMP_INVALID) {
      if (!anyTemp || s.tempX10 < lo) lo = s.tempX10;
      if (!anyTemp || s.tempX10 > hi) hi = s.tempX10;
      anyTemp = true;
    }
    if (s.humX10 != HUM_INVALID && s.humX10 > r.maxHumidityX10) r.maxHumidityX10 = s.humX10;
    if (s.flags & FLAG_GPS_FIX) {
      r.latE6 = s.latE6;
      r.lonE6 = s.lonE6;
    }
    if (s.flags & FLAG_LID_OPEN) r.tamper = true;
  }
  // A window with no valid temperature is treated as tampering: unplugging the sensor must not hide an excursion.
  if (!anyTemp) r.tamper = true;
  r.minTempX10 = lo;
  r.maxTempX10 = hi;

  keccak256_ctx c;
  keccak256_init(&c);
  keccak256_update(&c, (const uint8_t *)"TCv1", 4);
  be16(&c, (uint16_t)nSamples_);
  for (size_t i = 0; i < nSamples_; i++) {
    const Sample &s = samples_[i];
    be32(&c, s.t);
    be16(&c, (uint16_t)s.tempX10);
    be16(&c, s.humX10);
    be32(&c, (uint32_t)s.latE6);
    be32(&c, (uint32_t)s.lonE6);
    keccak256_update(&c, &s.flags, 1);
  }
  be16(&c, (uint16_t)nRfid_);
  for (size_t i = 0; i < nRfid_; i++) {
    const RfidEvent &e = rfid_[i];
    be32(&c, e.t);
    keccak256_update(&c, &e.uidLen, 1);
    keccak256_update(&c, e.uid, 10);
  }
  keccak256_final(&c, r.dataHash);
}
