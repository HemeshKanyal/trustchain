// Routes for the redesigned app: sign-in, private off-chain data, organisation stats, activity, live map.
import { createHash } from "node:crypto";
import { formatEther, getAddress, isAddress, keccak256, stringToHex } from "viem";
import { db } from "./db.js";
import { publicClient, trustChain, relayerAccount } from "./chain.js";
import { issueChallenge, login, requireSession, sessionAddress } from "./auth.js";
import { seal, open } from "./vault.js";
import { productKey } from "./ai/prices.js";

const ZERO = "0x0000000000000000000000000000000000000000";
const httpError = (status, message) => Object.assign(new Error(message), { status });
const lower = (a) => (a ?? "").toLowerCase();

const adminCache = new Map();
export async function isAdminAddress(address) {
  if (!address) return false;
  const hit = adminCache.get(address);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await trustChain.read.isAdmin([address]);
  adminCache.set(address, { value, until: Date.now() + 30_000 });
  return value;
}

/** Hide patient addresses from anyone who is not an admin; tell a patient whether it concerns them. */
export async function redactAlert(alert, viewer) {
  const af = alert.details?.affected;
  if (!af?.patients) return alert;
  if (await isAdminAddress(viewer)) return alert;
  const mine = Boolean(viewer && af.patients.some((p) => lower(p) === lower(viewer)));
  return { ...alert, details: { ...alert.details, affected: { ...af, patients: undefined, patientCount: af.patients.length, affectsViewer: mine } } };
}

export function redactEventArgs(name, args) {
  if (name === "StripDispensed" || name === "PrescriptionIssued") return { ...args, patient: args.patient === ZERO ? ZERO : null };
  return args;
}

function orgStats(address) {
  const a = lower(address);
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const made = one(
    `SELECT COUNT(*) AS batches, COALESCE(SUM(CAST(json_extract(args,'$.quantity') AS INTEGER)),0) AS strips
     FROM chain_events WHERE name='BatchCreated' AND lower(json_extract(args,'$.manufacturer'))=?`, a);
  const sent = one(`SELECT COUNT(*) AS n, SUM(device IS NOT NULL) AS monitored FROM shipments WHERE lower(from_addr)=?`, a);
  const received = one(`SELECT COUNT(*) AS n FROM shipments WHERE lower(to_addr)=? AND status='Delivered'`, a);
  const breached = one(
    `SELECT COUNT(DISTINCT s.id) AS n FROM shipments s JOIN alerts al ON al.shipment_id = s.id AND al.type='breach' WHERE lower(s.from_addr)=?`, a);
  const dispensed = one(`SELECT COUNT(*) AS n FROM chain_events WHERE name='StripDispensed' AND lower(json_extract(args,'$.pharmacy'))=?`, a);
  const rx = one(`SELECT COUNT(*) AS n FROM chain_events WHERE name='PrescriptionIssued' AND lower(json_extract(args,'$.doctor'))=?`, a);
  const recalls = one(`SELECT COUNT(*) AS n FROM chain_events WHERE name='BatchRecalled' AND lower(json_extract(args,'$.by'))=?`, a);
  const last = one(`SELECT MAX(timestamp) AS t FROM chain_events WHERE lower(args) LIKE ?`, `%${a}%`);
  const monitored = sent.monitored ?? 0;
  return {
    batchesMade: made.batches,
    stripsMade: made.strips,
    shipmentsSent: sent.n,
    shipmentsReceived: received.n,
    monitoredShipments: monitored,
    breachedShipments: breached.n,
    breachFreeRate: monitored ? (monitored - breached.n) / monitored : null,
    stripsDispensed: dispensed.n,
    prescriptionsIssued: rx.n,
    recallsIssued: recalls.n,
    lastActive: last.t ?? null,
  };
}

function lastFix(shipmentId) {
  return db
    .prepare(`SELECT s.t, s.lat_e6, s.lon_e6 FROM samples s JOIN reports r ON r.id = s.report_id
              WHERE r.shipment_id = ? AND (s.flags & 2) = 2 ORDER BY s.t DESC LIMIT 1`)
    .get(shipmentId) ?? null;
}

export function registerAppRoutes(app, asyncRoute) {
  // ---- wallet sign-in
  app.post("/api/auth/challenge", asyncRoute(async (req, res) => res.json(issueChallenge(req.body?.address))));
  app.post("/api/auth/login", asyncRoute(async (req, res) => res.json(await login(req.body ?? {}))));
  app.get("/api/auth/me", asyncRoute(async (req, res) => res.json({ address: requireSession(req) })));

  // ---- prescription details (encrypted; doctor writes, doctor/patient/active pharmacy read)
  app.put("/api/prescriptions/:id/details", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    const id = BigInt(req.params.id);
    const text = String(req.body?.text ?? "");
    if (!text || text.length > 4000) throw httpError(400, "text required (max 4000 chars)");
    const rx = await trustChain.read.getPrescription([id]);
    if (lower(rx.doctor) !== lower(who)) throw httpError(403, "only the issuing doctor can attach details");
    if (keccak256(stringToHex(text)) !== rx.contentHash) throw httpError(422, "text does not match the hash recorded on-chain");
    const s = seal(text);
    db.prepare(`INSERT INTO prescription_texts (id, iv, tag, ct, stored_at) VALUES (?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET iv=excluded.iv, tag=excluded.tag, ct=excluded.ct, stored_at=excluded.stored_at`)
      .run(Number(id), s.iv, s.tag, s.ct, Math.floor(Date.now() / 1000));
    res.json({ ok: true });
  }));

  app.get("/api/prescriptions/:id/details", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    const id = BigInt(req.params.id);
    const rx = await trustChain.read.getPrescription([id]);
    let allowed = lower(rx.doctor) === lower(who) || lower(rx.patient) === lower(who);
    if (!allowed) {
      const p = await trustChain.read.getParticipant([who]);
      allowed = Number(p.role) === 4 && p.active;
    }
    if (!allowed) throw httpError(403, "not allowed to read this prescription");
    const row = db.prepare("SELECT * FROM prescription_texts WHERE id = ?").get(Number(id));
    res.json({ id: Number(id), text: row ? open(row) : null });
  }));

  // ---- licence document attached to an application (applicant uploads; admin or self downloads)
  app.put("/api/applications/document", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    const { name, mime, data } = req.body ?? {};
    if (!["application/pdf", "image/png", "image/jpeg"].includes(mime)) throw httpError(400, "PDF, PNG or JPEG only");
    const buf = Buffer.from(String(data ?? ""), "base64");
    if (!buf.length || buf.length > 4 * 1024 * 1024) throw httpError(400, "file must be under 4 MB");
    const sha256 = createHash("sha256").update(buf).digest("hex");
    db.prepare(`INSERT INTO app_documents (address, name, mime, sha256, data, uploaded_at) VALUES (?,?,?,?,?,?)
                ON CONFLICT(address) DO UPDATE SET name=excluded.name, mime=excluded.mime, sha256=excluded.sha256, data=excluded.data, uploaded_at=excluded.uploaded_at`)
      .run(lower(who), String(name ?? "licence").slice(0, 120), mime, sha256, buf, Math.floor(Date.now() / 1000));
    res.json({ sha256 });
  }));

  app.get("/api/applications/:address/document/meta", asyncRoute(async (req, res) => {
    const row = db.prepare("SELECT name, mime, sha256, uploaded_at FROM app_documents WHERE address = ?").get(lower(req.params.address));
    res.json(row ?? null);
  }));

  app.get("/api/applications/:address/document", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    if (lower(who) !== lower(req.params.address) && !(await isAdminAddress(who))) throw httpError(403, "admins only");
    const row = db.prepare("SELECT * FROM app_documents WHERE address = ?").get(lower(req.params.address));
    if (!row) throw httpError(404, "no document");
    res.set("Content-Type", row.mime).set("Content-Disposition", `inline; filename="${row.name.replace(/"/g, "")}"`).send(Buffer.from(row.data));
  }));

  // ---- organisations
  app.get("/api/orgs/stats", asyncRoute(async (_req, res) => {
    const addrs = await trustChain.read.getParticipants();
    res.json(Object.fromEntries(addrs.map((a) => [a, orgStats(a)])));
  }));
  app.get("/api/orgs/:address/stats", asyncRoute(async (req, res) => {
    if (!isAddress(req.params.address, { strict: false })) throw httpError(400, "invalid address");
    res.json(orgStats(getAddress(req.params.address)));
  }));
  app.get("/api/orgs/:address/sales", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    if (lower(who) !== lower(req.params.address) && !(await isAdminAddress(who))) throw httpError(403, "not allowed");
    const rows = db
      .prepare(`SELECT args, tx_hash, timestamp FROM chain_events WHERE name='StripDispensed' AND lower(json_extract(args,'$.pharmacy'))=? ORDER BY block DESC, log_index DESC LIMIT 500`)
      .all(lower(req.params.address));
    res.json(rows.map((r) => ({ ...JSON.parse(r.args), txHash: r.tx_hash, timestamp: r.timestamp })));
  }));

  app.get("/api/orgs/:address/activity", asyncRoute(async (req, res) => {
    const a = lower(req.params.address);
    if (!/^0x[0-9a-f]{40}$/.test(a)) throw httpError(400, "invalid address");
    const rows = db
      .prepare(`SELECT name, args, tx_hash, timestamp, batch_id, shipment_id FROM chain_events
                WHERE name IN ('BatchCreated','ShipmentCreated','ShipmentDelivered','BatchRecalled','ParticipantRegistered','StripDispensed')
                AND lower(args) LIKE ? ORDER BY block DESC, log_index DESC LIMIT 50`)
      .all(`%${a}%`);
    res.json(rows.map((r) => ({ name: r.name, args: redactEventArgs(r.name, JSON.parse(r.args)), txHash: r.tx_hash, timestamp: r.timestamp, batchId: r.batch_id, shipmentId: r.shipment_id })));
  }));

  // ---- "Report this medicine" from the public verify page (no sign-in); regulators read them
  const recentReports = new Map();
  app.post("/api/reports", asyncRoute(async (req, res) => {
    const { codeHash, verdict, whereBought, note, contact, price, batchId } = req.body ?? {};
    if (!/^0x[0-9a-fA-F]{64}$/.test(codeHash ?? "")) throw httpError(400, "codeHash required");
    const ip = req.ip ?? "?";
    const last = recentReports.get(ip) ?? 0;
    if (Date.now() - last < 10_000) throw httpError(429, "please wait a few seconds before sending another report");
    recentReports.set(ip, Date.now());
    const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
    const r = db
      .prepare("INSERT INTO public_reports (code_hash, verdict, where_bought, note, contact, created_at) VALUES (?,?,?,?,?,?)")
      .run(codeHash.toLowerCase(), clip(verdict, 40) ?? "unknown", clip(whereBought, 200), clip(note, 1000), clip(contact, 200), Math.floor(Date.now() / 1000));
    if (Number(price) > 0 && Number(batchId) > 0) {
      const b = await trustChain.read.getBatch([BigInt(batchId)]);
      if (b.manufacturer !== "0x0000000000000000000000000000000000000000") {
        db.prepare("INSERT INTO price_reports (product_key, product_name, batch_id, price, source, reporter, created_at) VALUES (?,?,?,?,?,?,?)")
          .run(productKey(b.productName), b.productName, Number(batchId), Number(price), "public", null, Math.floor(Date.now() / 1000));
      }
    }
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));
  app.get("/api/reports", asyncRoute(async (req, res) => {
    const who = requireSession(req);
    if (!(await isAdminAddress(who))) throw httpError(403, "admins only");
    res.json(db.prepare("SELECT * FROM public_reports ORDER BY id DESC LIMIT 200").all());
  }));

  // ---- public activity feed (patients redacted)
  app.get("/api/activity", asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const rows = db
      .prepare(`SELECT name, args, tx_hash, timestamp, batch_id, shipment_id FROM chain_events
                WHERE name IN ('BatchCreated','ShipmentCreated','ShipmentDelivered','StripDispensed','BatchRecalled','BreachDetected','QuarantineReleased','ParticipantRegistered')
                ORDER BY block DESC, log_index DESC LIMIT ?`)
      .all(limit);
    res.json(rows.map((r) => ({ name: r.name, args: redactEventArgs(r.name, JSON.parse(r.args)), txHash: r.tx_hash, timestamp: r.timestamp, batchId: r.batch_id, shipmentId: r.shipment_id })));
  }));

  // ---- shipments for the live map
  app.get("/api/shipments", asyncRoute(async (req, res) => {
    const status = req.query.status;
    const rows = status
      ? db.prepare("SELECT * FROM shipments WHERE status = ? ORDER BY id DESC LIMIT 500").all(String(status))
      : db.prepare("SELECT * FROM shipments ORDER BY id DESC LIMIT 500").all();
    const breach = db.prepare("SELECT 1 FROM alerts WHERE type='breach' AND shipment_id = ? LIMIT 1");
    res.json(rows.map((s) => ({ ...s, lastFix: s.device ? lastFix(s.id) : null, breached: Boolean(breach.get(s.id)) })));
  }));

  // ---- relayer balance (admin system page)
  app.get("/api/relayer", asyncRoute(async (_req, res) => {
    if (!relayerAccount) return res.json({ address: null });
    const wei = await publicClient.getBalance({ address: relayerAccount.address });
    res.json({ address: relayerAccount.address, balance: formatEther(wei) });
  }));

}

export { sessionAddress };
