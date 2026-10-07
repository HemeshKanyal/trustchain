// AI endpoints + the data capture they rely on (anonymous scans, prices, delivery checks).
import { isAddress } from "viem";
import { db } from "./db.js";
import { trustChain } from "./chain.js";
import { requireSession, sessionAddress } from "./auth.js";
import { isAdminAddress } from "./routes-app.js";
import { aiOverview, batchRiskFor, complianceFor, demandForecast, getBatch, productList, tripAnalysis, tripAnomalies, priceStatsFor } from "./ai/data.js";
import { productKey } from "./ai/prices.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });
const nowS = () => Math.floor(Date.now() / 1000);
const VERDICTS = ["unknown", "genuine", "dispensed", "recalled", "quarantined", "expired"];

const limiter = new Map();
function rateLimit(req, key, perMinute) {
  const k = `${key}:${req.ip}`;
  const list = (limiter.get(k) ?? []).filter((t) => t > Date.now() - 60_000);
  if (list.length >= perMinute) throw httpError(429, "too many requests");
  list.push(Date.now());
  limiter.set(k, list);
}

export function registerAiRoutes(app, asyncRoute) {
  // ---- capture
  app.post("/api/scans", asyncRoute(async (req, res) => {
    rateLimit(req, "scan", 60);
    const { codeHash, verdict, visitor } = req.body ?? {};
    if (!/^0x[0-9a-fA-F]{64}$/.test(codeHash ?? "") || !VERDICTS.includes(verdict) || !/^[0-9a-f-]{8,64}$/i.test(visitor ?? "")) throw httpError(400, "bad scan");
    db.prepare("INSERT INTO scans (code_hash, verdict, visitor, created_at) VALUES (?,?,?,?)").run(codeHash.toLowerCase(), verdict, visitor, nowS());
    res.status(201).json({ ok: true });
  }));

  app.post("/api/prices", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    const p = await trustChain.read.getParticipant([who]);
    if (Number(p.role) !== 4 || !p.active) throw httpError(403, "pharmacies only");
    const batchId = Number(req.body?.batchId);
    const price = Number(req.body?.price);
    if (!(batchId > 0) || !(price > 0) || price > 1e6) throw httpError(400, "batchId and price required");
    const b = await getBatch(batchId);
    db.prepare("INSERT INTO price_reports (product_key, product_name, batch_id, price, source, reporter, created_at) VALUES (?,?,?,?,?,?,?)")
      .run(productKey(b.productName), b.productName, batchId, price, "pharmacy", who, nowS());
    res.status(201).json({ ok: true, market: priceStatsFor(b.productName) });
  }));

  app.post("/api/receive-checks", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    const shipmentId = Number(req.body?.shipmentId);
    const s = await trustChain.read.getShipment([BigInt(shipmentId)]);
    if (s.to.toLowerCase() !== who.toLowerCase()) throw httpError(403, "only the recipient checks a delivery");
    const found = req.body?.foundBatchId == null ? null : Number(req.body.foundBatchId);
    const ok = found === Number(s.batchId);
    db.prepare("INSERT INTO receive_checks (shipment_id, expected_batch, found_batch, ok, checker, created_at) VALUES (?,?,?,?,?,?)").run(shipmentId, Number(s.batchId), found, ok ? 1 : 0, who, nowS());
    res.status(201).json({ ok });
  }));

  // ---- analysis
  app.get("/api/ai/batches/:id/risk", asyncRoute(async (req, res) => {
    const r = await batchRiskFor(Number(req.params.id));
    if (!r) throw httpError(404, "no such batch");
    res.json(r);
  }));

  app.get("/api/ai/shipments/:id/coldchain", asyncRoute(async (req, res) => {
    const t = await tripAnalysis(Number(req.params.id));
    if (!t) throw httpError(404, "no such shipment");
    const anomalies = await tripAnomalies();
    res.json({ ...t, anomaly: anomalies.scores[t.shipmentId] ?? null, anomalyModel: anomalies.model, tripsModelled: anomalies.trips });
  }));

  app.get("/api/ai/orgs/:address/compliance", asyncRoute(async (req, res) => {
    if (!isAddress(req.params.address, { strict: false })) throw httpError(400, "invalid address");
    res.json(await complianceFor(req.params.address));
  }));

  app.get("/api/ai/products", asyncRoute(async (_req, res) => res.json(await productList())));

  app.get("/api/ai/forecast", asyncRoute(async (req, res) => {
    const product = String(req.query.product ?? "");
    if (!product) throw httpError(400, "product required");
    const pharmacy = req.query.pharmacy ? String(req.query.pharmacy) : null;
    if (pharmacy) {
      // Stock levels are private: only that pharmacy (or an admin) sees its own cover.
      const who = sessionAddress(req);
      if (!who || (who.toLowerCase() !== pharmacy.toLowerCase() && !(await isAdminAddress(who)))) throw httpError(403, "sign in as this pharmacy");
    }
    res.json(await demandForecast({ product, pharmacy, horizon: Math.min(60, Number(req.query.horizon ?? 30)) }));
  }));

  app.get("/api/ai/overview", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    if (!(await isAdminAddress(who))) throw httpError(403, "admins only");
    res.json(await aiOverview());
  }));
}
