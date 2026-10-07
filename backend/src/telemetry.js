// Telemetry wire format shared with the ESP32 firmware (iot/firmware/lib/ethsig/src/telemetry_window.cpp).
import { concat, keccak256, numberToHex, recoverTypedDataAddress, stringToHex, toHex } from "viem";

export const TEMP_INVALID = -32768;
export const HUM_INVALID = 0xffff;
export const FLAG_LID_OPEN = 1;
export const FLAG_GPS_FIX = 2;

export const reportTypes = {
  Report: [
    { name: "shipmentId", type: "uint256" },
    { name: "windowStart", type: "uint64" },
    { name: "windowEnd", type: "uint64" },
    { name: "readings", type: "uint32" },
    { name: "minTempX10", type: "int16" },
    { name: "maxTempX10", type: "int16" },
    { name: "maxHumidityX10", type: "uint16" },
    { name: "latE6", type: "int32" },
    { name: "lonE6", type: "int32" },
    { name: "tamper", type: "bool" },
    { name: "dataHash", type: "bytes32" },
    { name: "seq", type: "uint64" },
  ],
};

export function reportDomain(chainId, monitorAddress) {
  return { name: "TrustChainColdChain", version: "1", chainId, verifyingContract: monitorAddress };
}

const u = (v, bytes) => numberToHex(BigInt(v), { size: bytes });
const i = (v, bytes) => numberToHex(BigInt.asUintN(bytes * 8, BigInt(v)), { size: bytes });

/** samples: [[t, tempX10, humX10, latE6, lonE6, flags]], rfid: [[t, uidHex]] */
export function encodeDataHash(samples, rfid) {
  const parts = [stringToHex("TCv1"), u(samples.length, 2)];
  for (const [t, temp, hum, lat, lon, flags] of samples) {
    parts.push(u(t, 4), i(temp, 2), u(hum, 2), i(lat, 4), i(lon, 4), u(flags, 1));
  }
  parts.push(u(rfid.length, 2));
  for (const [t, uidHex] of rfid) {
    const uid = uidHex.replace(/^0x/, "").slice(0, 20);
    parts.push(u(t, 4), u(uid.length / 2, 1), `0x${uid.padEnd(20, "0")}`);
  }
  return keccak256(concat(parts));
}

/** Same aggregation as TelemetryWindow::summarize on the device. */
export function summarize(samples) {
  let min = null;
  let max = null;
  let maxHum = 0;
  let lat = 0;
  let lon = 0;
  let tamper = false;
  for (const [, temp, hum, la, lo, flags] of samples) {
    if (temp !== TEMP_INVALID) {
      min = min === null ? temp : Math.min(min, temp);
      max = max === null ? temp : Math.max(max, temp);
    }
    if (hum !== HUM_INVALID) maxHum = Math.max(maxHum, hum);
    if (flags & FLAG_GPS_FIX) [lat, lon] = [la, lo];
    if (flags & FLAG_LID_OPEN) tamper = true;
  }
  if (min === null) tamper = true;
  return { readings: samples.length, minTempX10: min ?? 0, maxTempX10: max ?? 0, maxHumidityX10: maxHum, latE6: lat, lonE6: lon, tamper };
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isHex = (v, bytes) => typeof v === "string" && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(v);

/** Validate shape, raw-data consistency and signature. Returns { report, signer } or throws { status, message }. */
export async function verifyTelemetry(body, { chainId, monitorAddress }) {
  const fail = (message, status = 422) => {
    throw Object.assign(new Error(message), { status });
  };
  const { device, report: r, signature, samples = [], rfid = [] } = body ?? {};
  if (!isHex(device, 20) || !r || !isHex(signature, 65)) fail("device, report and signature are required", 400);
  if (!Array.isArray(samples) || !Array.isArray(rfid) || samples.length > 1000 || rfid.length > 100) fail("bad samples", 400);

  for (const s of samples) {
    if (!Array.isArray(s) || s.length !== 6) fail("sample must be [t, tempX10, humX10, latE6, lonE6, flags]", 400);
    const [t, temp, hum, lat, lon, flags] = s;
    if (!isInt(t, 0, 2 ** 32 - 1) || !isInt(temp, -32768, 32767) || !isInt(hum, 0, 65535) ||
        !isInt(lat, -(2 ** 31), 2 ** 31 - 1) || !isInt(lon, -(2 ** 31), 2 ** 31 - 1) || !isInt(flags, 0, 255)) {
      fail("sample out of range", 400);
    }
  }
  for (const e of rfid) {
    if (!Array.isArray(e) || !isInt(e[0], 0, 2 ** 32 - 1) || !/^(0x)?([0-9a-fA-F]{2}){1,10}$/.test(e[1])) fail("bad rfid event", 400);
  }

  const report = {
    shipmentId: BigInt(r.shipmentId),
    windowStart: BigInt(r.windowStart),
    windowEnd: BigInt(r.windowEnd),
    readings: Number(r.readings),
    minTempX10: Number(r.minTempX10),
    maxTempX10: Number(r.maxTempX10),
    maxHumidityX10: Number(r.maxHumidityX10),
    latE6: Number(r.latE6),
    lonE6: Number(r.lonE6),
    tamper: Boolean(r.tamper),
    dataHash: r.dataHash,
    seq: BigInt(r.seq),
  };
  if (!isHex(report.dataHash, 32)) fail("bad dataHash", 400);

  if (encodeDataHash(samples, rfid).toLowerCase() !== report.dataHash.toLowerCase()) fail("dataHash does not match samples");
  const s = summarize(samples);
  for (const k of ["readings", "minTempX10", "maxTempX10", "maxHumidityX10", "latE6", "lonE6", "tamper"]) {
    if (s[k] !== report[k]) fail(`report.${k}=${report[k]} does not match samples (${s[k]})`);
  }

  const signer = await recoverTypedDataAddress({
    domain: reportDomain(chainId, monitorAddress),
    types: reportTypes,
    primaryType: "Report",
    message: report,
    signature,
  });
  if (signer.toLowerCase() !== device.toLowerCase()) fail("signature does not match device", 401);
  return { report, signer };
}

export { toHex };
