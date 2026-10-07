#pragma once
// Collects raw samples for one report window and derives the signed on-chain summary.
//
// dataHash = keccak256("TCv1" || u16 nSamples || samples || u16 nRfid || rfidEvents), all big-endian:
//   sample (17 B): u32 t | i16 tempX10 | u16 humX10 | i32 latE6 | i32 lonE6 | u8 flags
//   rfid   (15 B): u32 t | u8 uidLen | uid[10] zero-padded
// Invalid temperature = INT16_MIN, invalid humidity = 0xFFFF. flags: bit0 lid open, bit1 GPS fix.
// backend/src/telemetry.js implements the same encoding; keep them in sync.
#include <stddef.h>
#include <stdint.h>

#include "eip712_report.h"

constexpr int16_t TEMP_INVALID = INT16_MIN;
constexpr uint16_t HUM_INVALID = 0xFFFF;
constexpr uint8_t FLAG_LID_OPEN = 1;
constexpr uint8_t FLAG_GPS_FIX = 2;

struct Sample {
  uint32_t t;
  int16_t tempX10;
  uint16_t humX10;
  int32_t latE6;
  int32_t lonE6;
  uint8_t flags;
};

struct RfidEvent {
  uint32_t t;
  uint8_t uidLen;
  uint8_t uid[10];
};

class TelemetryWindow {
 public:
  static constexpr size_t MAX_SAMPLES = 120;
  static constexpr size_t MAX_RFID = 16;

  void reset(uint32_t windowStart);
  bool addSample(const Sample &s);
  bool addRfid(const RfidEvent &e);

  /// Fill every Report field except shipmentId and seq.
  void summarize(uint32_t windowEnd, TelemetryReport &r) const;

  uint32_t start() const { return start_; }
  size_t sampleCount() const { return nSamples_; }
  size_t rfidCount() const { return nRfid_; }
  const Sample &sample(size_t i) const { return samples_[i]; }
  const RfidEvent &rfid(size_t i) const { return rfid_[i]; }

 private:
  uint32_t start_ = 0;
  Sample samples_[MAX_SAMPLES];
  RfidEvent rfid_[MAX_RFID];
  size_t nSamples_ = 0;
  size_t nRfid_ = 0;
};
