// Turns chain + backend data into model inputs. Short in-memory caches keep dashboards fast.
import { db } from "../db.js";
import { trustChain } from "../chain.js";
import { analyzeTrip, tripFeatures } from "./coldchain.js";
import { isolationForest } from "./iforest.js";
import { cloneSignals, unknownBursts } from "./scans.js";
import { priceFinding, priceStats, productKey } from "./prices.js";
import { complianceScore } from "./compliance.js";
import { batchRisk } from "./risk.js";
import { backtest, dailySeries, dayIndex, daysOfCover, forecast } from "./forecast.js";
import { marketFor, market } from "./market.js";

const now = () => Math.floor(Date.now() / 1000);
const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, until: Date.now() + ttlMs });
  return value;
}

export const getBatch = (id) =>
  cached(`batch:${id}`, 10_000, async () => {
    const b = await trustChain.read.getBatch([BigInt(id)]);
    return { id: Number(id), ...b, status: Number(b.status) };
  });

const shipmentsOfBatch = (batchId) => db.prepare("SELECT * FROM shipments WHERE batch_id = ? ORDER BY id").all(batchId);
const samplesOf = (shipmentId) =>
  db.prepare("SELECT s.t, s.temp_x10, s.humidity_x10, s.lat_e6, s.lon_e6, s.flags FROM samples s JOIN reports r ON r.id = s.report_id WHERE r.shipment_id = ? ORDER BY s.t").all(shipmentId);

export async function tripAnalysis(shipmentId) {
  const s = db.prepare("SELECT * FROM shipments WHERE id = ?").get(shipmentId);
  if (!s) return null;
  const batch = await getBatch(s.batch_id);
  if (!s.device) return { shipmentId, monitored: false, batchId: s.batch_id, status: s.status, analysis: null };
  const rows = samplesOf(shipmentId);
  const last = rows.at(-1)?.t ?? 0;
  const analysis = await cached(`trip:${shipmentId}:${rows.length}:${last}`, 60_000, async () => analyzeTrip(rows, batch.conditions));
  return { shipmentId, monitored: true, batchId: s.batch_id, status: s.status, analysis };
}

/** Isolation-forest anomaly score per monitored trip, fitted on every trip with enough readings. */
export const tripAnomalies = () =>
  cached("anomalies", 30_000, async () => {
    const ids = db.prepare("SELECT id FROM shipments WHERE device IS NOT NULL").all().map((r) => r.id);
    const trips = (await Promise.all(ids.map(tripAnalysis))).filter((t) => t?.analysis?.samples >= 6);
    if (trips.length < 8) return { model: null, trips: trips.length, scores: {} };
    const rows = trips.map((t) => tripFeatures(t.analysis));
    const score = isolationForest(rows);
    return { model: "isolation forest", trips: trips.length, scores: Object.fromEntries(trips.map((t, i) => [t.shipmentId, score(rows[i])])) };
  });

function soldAtForBatch(batchId) {
  const rows = db.prepare("SELECT args, timestamp FROM chain_events WHERE name = 'StripDispensed' AND batch_id = ?").all(batchId);
  return new Map(rows.map((r) => [JSON.parse(r.args).codeHash.toLowerCase(), r.timestamp]));
}

export async function batchRiskFor(batchId) {
  return cached(`risk:${batchId}`, 10_000, async () => {
    const batch = await getBatch(batchId);
    if (batch.manufacturer === "0x0000000000000000000000000000000000000000") return null;
    const anomalies = await tripAnomalies();
    const trips = await Promise.all(shipmentsOfBatch(batchId).map(async (s) => ({ ...(await tripAnalysis(s.id)), anomaly: anomalies.scores[s.id] ?? null })));
    const sold = soldAtForBatch(batchId);
    const scans = sold.size ? db.prepare(`SELECT * FROM scans WHERE code_hash IN (${[...sold.keys()].map(() => "?").join(",")})`).all(...sold.keys()) : [];
    const mismatches = db.prepare("SELECT COUNT(*) AS n FROM receive_checks WHERE expected_batch = ? AND ok = 0").get(batchId).n;
    const stats = priceStatsFor(batch.productName);
    const priceFindings = db
      .prepare("SELECT * FROM price_reports WHERE batch_id = ? ORDER BY id DESC LIMIT 50")
      .all(batchId)
      .map((p) => priceFinding(p.price, stats, p.source === "public" ? "(reported by a buyer)" : "(pharmacy sale)"))
      .filter(Boolean);
    const risk = batchRisk({ batch, trips, clones: cloneSignals(scans, sold), mismatches, priceFindings, now: now() });
    return { batchId: Number(batchId), productName: batch.productName, lotNumber: batch.lotNumber, ...risk, trips: trips.map((t) => ({ shipmentId: t.shipmentId, monitored: t.monitored, anomaly: t.anomaly, summary: t.analysis && { mkt: t.analysis.mkt, minC: t.analysis.minC, maxC: t.analysis.maxC, excursionMinutes: t.analysis.excursionMinutes, tamperEvents: t.analysis.tamperEvents } })) };
  });
}

/** Market reference (sample dataset) merged with live pharmacy-reported prices for the same medicine. */
export function priceStatsFor(productName) {
  const key = productKey(productName);
  const live = db.prepare("SELECT price FROM price_reports WHERE product_key = ? AND source = 'pharmacy'").all(key).map((r) => r.price);
  const ref = marketFor(productName);
  if (live.length >= 5) return { ...priceStats(live), source: "pharmacy sales on TrustChain" };
  if (ref) return { ...ref.price, source: market.source };
  return priceStats(live);
}

export async function complianceFor(address) {
  const a = address.toLowerCase();
  return cached(`compliance:${a}`, 20_000, async () => {
    const sent = db.prepare("SELECT * FROM shipments WHERE lower(from_addr) = ?").all(a);
    let unmonitoredCold = 0;
    for (const s of sent) if (!s.device && Number((await getBatch(s.batch_id)).conditions.maxTempX10) <= 80) unmonitoredCold++;
    const breachSent = db.prepare("SELECT COUNT(DISTINCT s.id) AS n FROM shipments s JOIN alerts al ON al.shipment_id = s.id AND al.type='breach' WHERE lower(s.from_addr) = ?").get(a).n;
    const created = db.prepare("SELECT shipment_id, timestamp FROM chain_events WHERE name='ShipmentCreated'").all();
    const delivered = Object.fromEntries(db.prepare("SELECT shipment_id, timestamp FROM chain_events WHERE name='ShipmentDelivered'").all().map((r) => [r.shipment_id, r.timestamp]));
    const toMe = new Set(db.prepare("SELECT id FROM shipments WHERE lower(to_addr) = ?").all(a).map((r) => r.id));
    const slow = created.filter((c) => toMe.has(c.shipment_id) && ((delivered[c.shipment_id] ?? now()) - c.timestamp) > 72 * 3600).length;
    const recalled = db.prepare("SELECT DISTINCT batch_id FROM chain_events WHERE name='BatchRecalled'").all().map((r) => r.batch_id);
    let recalledHeld = 0;
    for (const b of recalled) {
      const batch = await getBatch(b);
      if (batch.manufacturer.toLowerCase() === a) continue;
      recalledHeld += Number(await trustChain.read.balanceOf([BigInt(b), address]));
    }
    const sales = db.prepare("SELECT args, batch_id, timestamp FROM chain_events WHERE name='StripDispensed' AND lower(json_extract(args,'$.pharmacy')) = ?").all(a);
    let nearExpiry = 0;
    for (const s of sales) if (Number((await getBatch(s.batch_id)).expiresAt) - s.timestamp < 7 * 86400) nearExpiry++;
    const myPrices = db.prepare("SELECT * FROM price_reports WHERE lower(reporter) = ?").all(a);
    let priceAnomalies = 0;
    for (const p of myPrices) if (priceFinding(p.price, priceStatsFor(p.product_name))) priceAnomalies++;
    const mismatchSent = db.prepare("SELECT COUNT(*) AS n FROM receive_checks rc JOIN shipments s ON s.id = rc.shipment_id WHERE rc.ok = 0 AND lower(s.from_addr) = ?").get(a).n;
    return complianceScore({
      UNMONITORED_COLD: unmonitoredCold,
      BREACH_SENT: breachSent,
      SLOW_RECEIPT: slow,
      RECALLED_STOCK_HELD: recalledHeld,
      NEAR_EXPIRY_SALES: nearExpiry,
      PRICE_ANOMALY: priceAnomalies,
      RECEIVE_MISMATCH: mismatchSent,
    });
  });
}

/** Demand forecast for a medicine, optionally for one pharmacy, with stock cover and a reorder suggestion. */
export async function demandForecast({ product, pharmacy = null, horizon = 30 }) {
  const key = productKey(product);
  const rows = db.prepare("SELECT args, batch_id, timestamp FROM chain_events WHERE name='StripDispensed'").all();
  const events = [];
  const batchIds = new Set();
  for (const r of rows) {
    const b = await getBatch(r.batch_id);
    if (productKey(b.productName) !== key) continue;
    if (pharmacy && JSON.parse(r.args).pharmacy.toLowerCase() !== pharmacy.toLowerCase()) continue;
    events.push({ t: r.timestamp, qty: 1 });
    batchIds.add(r.batch_id);
  }
  // Train on completed days only: today's partial count would read as a drop in demand.
  const today = dayIndex(now());
  const { start, values } = dailySeries(events.filter((e) => dayIndex(e.t) < today), today - 1);
  const f = forecast(values, horizon);
  const bt = backtest(values, 14);
  let stock = null;
  if (pharmacy) {
    stock = 0;
    const n = Number(await trustChain.read.batchCount());
    for (let i = 1; i <= n; i++) {
      const b = await getBatch(i);
      if (productKey(b.productName) !== key || b.status !== 0 || Number(b.expiresAt) < now()) continue;
      stock += Number(await trustChain.read.balanceOf([BigInt(i), pharmacy]));
    }
  }
  const cover = stock == null ? null : daysOfCover(stock, f.points);
  const next14 = f.points.slice(0, 14).reduce((s, p) => s + p.mean, 0);
  const reorder = stock != null && cover !== Infinity && cover < 14 ? Math.max(0, Math.ceil(next14 * 1.2 - stock)) : 0;
  const ref = marketFor(product);
  return {
    product: key,
    pharmacy,
    method: f.method,
    historyDays: values.length,
    history: values.map((v, i) => ({ day: (start + i) * 86400, units: v })),
    forecast: f.points.map((p) => ({ day: (today - 1 + p.step) * 86400, mean: p.mean, lo: p.lo, hi: p.hi })),
    soldToday: events.filter((e) => dayIndex(e.t) === today).length,
    backtest: bt,
    stock,
    daysOfCover: cover === Infinity ? null : cover,
    reorder,
    market: ref ? { name: ref.name, medianPrice: ref.price.median, dailyUnits: ref.dailyUnits, source: market.source } : null,
  };
}

/** Products that have been dispensed (or minted), for pickers. */
export async function productList() {
  const n = Number(await trustChain.read.batchCount());
  const names = new Map();
  for (let i = 1; i <= n; i++) {
    const b = await getBatch(i);
    names.set(productKey(b.productName), b.productName);
  }
  return [...names.entries()].map(([key, name]) => ({ key, name }));
}

export async function aiOverview() {
  return cached("overview", 10_000, async () => {
    const n = Number(await trustChain.read.batchCount());
    const batches = (await Promise.all(Array.from({ length: n }, (_, i) => batchRiskFor(i + 1)))).filter(Boolean).sort((x, y) => y.score - x.score);
    const orgs = await trustChain.read.getParticipants();
    const compliance = [];
    for (const a of orgs) {
      const p = await trustChain.read.getParticipant([a]);
      if (Number(p.role) < 2) continue;
      compliance.push({ address: a, name: p.name, role: Number(p.role), active: p.active, ...(await complianceFor(a)) });
    }
    compliance.sort((x, y) => x.score - y.score);
    const scans = db.prepare("SELECT * FROM scans WHERE created_at > ?").all(now() - 30 * 86400);
    const clones = [];
    for (const b of batches) for (const r of b.reasons) if (r.code === "CLONE") clones.push({ batchId: b.batchId, productName: b.productName, text: r.text });
    const prices = db
      .prepare("SELECT * FROM price_reports ORDER BY id DESC LIMIT 200")
      .all()
      .map((p) => ({ ...p, finding: priceFinding(p.price, priceStatsFor(p.product_name)) }))
      .filter((p) => p.finding);
    const anomalies = await tripAnomalies();
    return {
      generatedAt: now(),
      batches,
      compliance,
      scans: { total: scans.length, unknown: scans.filter((s) => s.verdict === "unknown").length, ...unknownBursts(scans), clones },
      prices,
      model: { anomaly: anomalies.model, tripsModelled: anomalies.trips, market: market.source },
    };
  });
}
