import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeTrip, meanKineticTemperature } from "../src/ai/coldchain.js";
import { isolationForest } from "../src/ai/iforest.js";
import { backtest, dailySeries, daysOfCover, forecast } from "../src/ai/forecast.js";
import { priceFinding, priceStats, productKey } from "../src/ai/prices.js";
import { cloneSignals, unknownBursts } from "../src/ai/scans.js";
import { complianceScore } from "../src/ai/compliance.js";
import { batchRisk } from "../src/ai/risk.js";

const COLD = { minTempX10: 20, maxTempX10: 80, maxHumidityX10: 700 };
const trip = (temps, { step = 10, flags = () => 2, t0 = 1_790_000_000 } = {}) =>
  temps.map((c, i) => ({ t: t0 + i * step, temp_x10: c == null ? null : Math.round(c * 10), humidity_x10: 500, flags: flags(i) }));

test("MKT of a constant temperature is that temperature", () => {
  const pts = [0, 60, 120, 180].map((t) => ({ t, c: 5 }));
  assert.ok(Math.abs(meanKineticTemperature(pts) - 5) < 1e-9);
});

test("MKT weights heat more than the plain average (Arrhenius)", () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ t: i * 60, c: i % 2 ? 2 : 8 }));
  const mkt = meanKineticTemperature(pts);
  assert.ok(mkt > 5.05 && mkt < 8, `mkt=${mkt}`);
});

test("a clean 2–8°C trip has no risk findings", () => {
  const a = analyzeTrip(trip(Array.from({ length: 60 }, (_, i) => 4.5 + Math.sin(i / 5))), COLD);
  assert.deepEqual(a.findings.map((f) => f.code), ["OK"]);
  assert.equal(a.minutesAbove, 0);
});

test("a heat excursion is critical with its peak and duration", () => {
  const temps = [...Array(30).fill(5), ...Array(12).fill(41.2), ...Array(30).fill(5)];
  const a = analyzeTrip(trip(temps, { step: 60 }), COLD);
  const hot = a.findings.find((f) => f.code === "TEMP_HIGH");
  assert.equal(hot.severity, "critical");
  assert.match(hot.text, /41\.2°C/);
  assert.equal(a.minutesAbove, 12);
  assert.equal(a.excursions.length, 1);
  assert.ok(a.findings.some((f) => f.code === "MKT_OUT"), "12 min at 41°C pushes MKT over 8°C");
});

test("lid openings, sensor faults and gaps are reported", () => {
  const rows = trip([5, 5, 5, null, 5, 5, 5, 5], { flags: (i) => (i === 2 || i === 3 ? 3 : 2) });
  rows.push({ t: rows.at(-1).t + 600, temp_x10: 50, humidity_x10: 500, flags: 2 }); // 10 min silence
  const codes = analyzeTrip(rows, COLD).findings.map((f) => f.code);
  for (const c of ["TAMPER", "SENSOR_FAULT", "SENSOR_GAP"]) assert.ok(codes.includes(c), `${c} in ${codes}`);
});

test("isolation forest isolates an outlier", () => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const normal = Array.from({ length: 200 }, () => [5 + r(), 6 + r(), 0.01 * r()]);
  const score = isolationForest([...normal, [30, 41, 0.6]]);
  const typical = normal.map(score).sort((a, b) => a - b)[100];
  assert.ok(score([30, 41, 0.6]) > 0.62, `outlier ${score([30, 41, 0.6])}`);
  assert.ok(typical < 0.55, `typical ${typical}`);
});

test("Holt-Winters learns a weekly pattern (back-test error under 15%)", () => {
  let s = 3;
  const noise = () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5) * 2;
  const y = Array.from({ length: 98 }, (_, d) => 20 + d * 0.05 + (d % 7 >= 5 ? 12 : 0) + noise());
  const f = forecast(y, 14);
  assert.equal(f.method, "Holt-Winters (weekly)");
  const bt = backtest(y, 14);
  assert.ok(bt.wape < 0.15, `wape=${bt.wape}`);
  const weekend = f.points.filter((p, i) => (98 + i) % 7 >= 5).map((p) => p.mean);
  const weekday = f.points.filter((p, i) => (98 + i) % 7 < 5).map((p) => p.mean);
  assert.ok(Math.min(...weekend) > Math.max(...weekday), "weekend peak preserved");
});

test("short histories fall back gracefully and days-of-cover works", () => {
  assert.equal(forecast([3, 4], 7).method, "average");
  assert.equal(forecast([3, 4, 5, 4, 3, 4], 7).method, "exponential smoothing");
  const pts = Array.from({ length: 10 }, (_, i) => ({ step: i + 1, mean: 5 }));
  assert.equal(daysOfCover(12, pts), 2.4);
  assert.equal(daysOfCover(100, pts), Infinity);
});

test("daily series fills empty days", () => {
  const { values } = dailySeries([{ t: 0 }, { t: 86400 * 3, qty: 2 }]);
  assert.deepEqual(values, [1, 0, 0, 2]);
});

test("price far below market is flagged", () => {
  assert.equal(productKey("Amoxicillin 500mg capsules"), "amoxicillin");
  const stats = priceStats([90, 100, 110, 105, 95]);
  assert.equal(stats.median, 100);
  assert.equal(priceFinding(25, stats).severity, "critical");
  assert.equal(priceFinding(95, stats), null);
  assert.equal(priceFinding(250, stats).code, "PRICE_HIGH");
});

test("a sold code scanned by many visitors is a likely clone", () => {
  const sold = new Map([["0xa", 1000]]);
  const scans = ["v1", "v2", "v3"].map((v, i) => ({ code_hash: "0xa", verdict: "dispensed", visitor: v, created_at: 2000 + i }));
  scans.push({ code_hash: "0xa", verdict: "genuine", visitor: "early", created_at: 500 });
  assert.deepEqual(cloneSignals(scans, sold), [{ codeHash: "0xa", visitors: 3 }]);
  assert.deepEqual(cloneSignals(scans.slice(0, 2), sold), []);
});

test("a burst of unknown-code scans is detected", () => {
  const now = 100 * 86400;
  const scans = Array.from({ length: 8 }, (_, i) => ({ verdict: "unknown", created_at: now - 100 - i }));
  scans.push({ verdict: "unknown", created_at: now - 5 * 86400 });
  assert.equal(unknownBursts(scans, { now }).burst, true);
});

test("compliance score subtracts capped penalties", () => {
  const c = complianceScore({ UNMONITORED_COLD: 1, RECALLED_STOCK_HELD: 4 });
  assert.equal(c.score, 100 - 15 - 40);
  assert.equal(c.issues[0].code, "RECALLED_STOCK_HELD");
  assert.equal(complianceScore({}).grade, "A");
});

test("batch risk combines signals and explains itself", () => {
  const now = 1_790_000_000;
  const batch = { status: 0, expiresAt: now + 365 * 86400, conditions: COLD };
  assert.equal(batchRisk({ batch, now }).level, "low");
  const hot = analyzeTrip(trip([...Array(10).fill(5), ...Array(40).fill(12)], { step: 60 }), COLD);
  const r = batchRisk({
    batch,
    now,
    trips: [{ shipmentId: 4, monitored: true, analysis: hot }],
    clones: [{ codeHash: "0xa", visitors: 4 }],
    priceFindings: [priceFinding(20, priceStats([100, 100, 100]))],
  });
  assert.equal(r.level, "high");
  assert.equal(r.score, 100);
  const codes = r.reasons.map((x) => x.code);
  for (const c of ["TEMP_HIGH", "CLONE", "PRICE_LOW"]) assert.ok(codes.includes(c));
  assert.equal(batchRisk({ batch: { ...batch, status: 2 }, now }).score, 100);
  const silent = batchRisk({ batch, now, trips: [{ shipmentId: 9, monitored: true, status: "Delivered", analysis: { samples: 0, findings: [] } }] });
  assert.equal(silent.reasons[0].code, "NO_TELEMETRY");
});
