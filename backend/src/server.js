import express from "express";
import { getAddress, isAddress } from "viem";
import { config } from "./config.js";
import { db, transaction } from "./db.js";
import { monitor, trustChain, ShipmentStatus, relayerAccount } from "./chain.js";
import { verifyTelemetry } from "./telemetry.js";
import { startIndexer } from "./indexer.js";
import { startRelayer } from "./relayer.js";
import { affectedParties } from "./affected.js";
import { bus } from "./events.js";
import { registerAppRoutes, redactAlert, redactEventArgs, sessionAddress } from "./routes-app.js";
import { registerAiRoutes } from "./routes-ai.js";
import { registerSimRoutes } from "./routes-sim.js";

const app = express();
app.use(express.json({ limit: "6mb" }));
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", config.corsOrigin);
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const asyncRoute = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    const status = e.status ?? 500;
    if (status >= 500) console.error(e);
    res.status(status).json({ error: e.shortMessage ?? e.message });
  });

const httpError = (status, message) => Object.assign(new Error(message), { status });
const parseId = (v) => {
  if (!/^\d+$/.test(v)) throw httpError(400, "invalid id");
  return Number(v);
};

// ------------------------------------------------------------------ health

app.get("/api/health", asyncRoute(async (_req, res) => {
  const indexed = db.prepare("SELECT value FROM meta WHERE key = 'indexedBlock'").get()?.value ?? null;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'pending'").get().n;
  res.json({
    ok: true,
    chainId: config.chainId,
    trustChain: config.trustChain,
    monitor: config.monitor,
    relayer: relayerAccount?.address ?? null,
    indexedBlock: indexed,
    pendingReports: pending,
  });
}));

// ------------------------------------------------------------------ devices

async function activeShipmentFor(device) {
  const rows = db
    .prepare("SELECT id FROM shipments WHERE device = ? AND status = 'InTransit' ORDER BY id DESC")
    .all(device.toLowerCase());
  for (const { id } of rows) {
    const info = await trustChain.read.monitoringInfo([BigInt(id)]);
    if (ShipmentStatus[info.status] === "InTransit" && info.device.toLowerCase() === device.toLowerCase()) {
      return { id, info };
    }
  }
  return null;
}

app.get("/api/devices/:address/config", asyncRoute(async (req, res) => {
  if (!isAddress(req.params.address, { strict: false })) throw httpError(400, "invalid address");
  const device = getAddress(req.params.address);
  const [registered, active] = await Promise.all([monitor.read.isActiveDevice([device]), activeShipmentFor(device)]);
  res.json({
    device,
    registered,
    chainId: config.chainId,
    monitor: config.monitor,
    shipmentId: registered && active ? active.id : null,
    conditions: active
      ? {
          minTempX10: active.info.conditions.minTempX10,
          maxTempX10: active.info.conditions.maxTempX10,
          maxHumidityX10: active.info.conditions.maxHumidityX10,
        }
      : null,
    windowSeconds: config.windowSeconds,
    sampleSeconds: config.sampleSeconds,
    serverTime: Math.floor(Date.now() / 1000),
  });
}));

app.get("/api/devices", asyncRoute(async (_req, res) => {
  const addresses = await monitor.read.getDevices();
  const last = db.prepare("SELECT * FROM reports WHERE device = ? ORDER BY id DESC LIMIT 1");
  const active = db.prepare("SELECT id FROM shipments WHERE device = ? AND status = 'InTransit' ORDER BY id DESC LIMIT 1");
  const devices = await Promise.all(
    addresses.map(async (address) => {
      const d = await monitor.read.getDevice([address]);
      const r = last.get(address.toLowerCase());
      return {
        address,
        label: d.label,
        active: d.active,
        lastReport: r ? { shipmentId: r.shipment_id, seq: r.seq, windowEnd: r.window_end, status: r.status } : null,
        activeShipment: active.get(address.toLowerCase())?.id ?? null,
      };
    }),
  );
  res.json(devices);
}));

// ------------------------------------------------------------------ telemetry ingest

const insertReport = db.prepare(`INSERT INTO reports
  (shipment_id, device, seq, window_start, window_end, readings, min_temp_x10, max_temp_x10, max_humidity_x10,
   lat_e6, lon_e6, tamper, data_hash, signature, received_at, status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`);
const insertSample = db.prepare("INSERT INTO samples (report_id, t, temp_x10, humidity_x10, lat_e6, lon_e6, flags) VALUES (?,?,?,?,?,?,?)");
const insertRfid = db.prepare("INSERT INTO rfid_events (report_id, t, uid) VALUES (?,?,?)");

app.post("/api/telemetry", asyncRoute(async (req, res) => {
  const { report, signer } = await verifyTelemetry(req.body, { chainId: config.chainId, monitorAddress: config.monitor });

  const info = await trustChain.read.monitoringInfo([report.shipmentId]);
  if (info.device.toLowerCase() !== signer.toLowerCase()) throw httpError(403, "device is not assigned to this shipment");

  const existing = db
    .prepare("SELECT id, signature, status FROM reports WHERE shipment_id = ? AND seq = ?")
    .get(Number(report.shipmentId), Number(report.seq));
  if (existing) {
    if (existing.signature.toLowerCase() === req.body.signature.toLowerCase()) {
      return res.status(200).json({ id: existing.id, status: existing.status, duplicate: true });
    }
    throw httpError(409, "a different report with this seq already exists");
  }

  const id = transaction(() => {
    const r = report;
    const reportId = Number(
      insertReport.run(
        Number(r.shipmentId), signer.toLowerCase(), Number(r.seq), Number(r.windowStart), Number(r.windowEnd),
        r.readings, r.minTempX10, r.maxTempX10, r.maxHumidityX10, r.latE6, r.lonE6, r.tamper ? 1 : 0,
        r.dataHash, req.body.signature, Math.floor(Date.now() / 1000),
      ).lastInsertRowid,
    );
    for (const [t, temp, hum, lat, lon, flags] of req.body.samples ?? []) {
      insertSample.run(reportId, t, temp === -32768 ? null : temp, hum === 65535 ? null : hum, lat, lon, flags);
    }
    for (const [t, uid] of req.body.rfid ?? []) insertRfid.run(reportId, t, uid.replace(/^0x/, "").toLowerCase());
    return reportId;
  });
  res.status(202).json({ id, status: "pending" });
}));

// ------------------------------------------------------------------ read APIs (frontend)

app.get("/api/shipments/:id/telemetry", asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const shipment = db.prepare("SELECT * FROM shipments WHERE id = ?").get(id) ?? null;
  const reports = db
    .prepare(`SELECT id, seq, window_start, window_end, readings, min_temp_x10, max_temp_x10, max_humidity_x10,
              lat_e6, lon_e6, tamper, data_hash, status, error, tx_hash, breach_flags
              FROM reports WHERE shipment_id = ? ORDER BY seq`)
    .all(id);
  const samples = db
    .prepare(`SELECT s.t, s.temp_x10, s.humidity_x10, s.lat_e6, s.lon_e6, s.flags FROM samples s
              JOIN reports r ON r.id = s.report_id WHERE r.shipment_id = ? ORDER BY s.t`)
    .all(id);
  const rfid = db
    .prepare(`SELECT e.t, e.uid FROM rfid_events e JOIN reports r ON r.id = e.report_id WHERE r.shipment_id = ? ORDER BY e.t`)
    .all(id);
  res.json({ shipment, reports, samples, rfid });
}));

app.get("/api/batches/:id/timeline", asyncRoute(async (req, res) => {
  const id = parseId(req.params.id);
  const shipmentIds = db.prepare("SELECT id FROM shipments WHERE batch_id = ?").all(id).map((r) => r.id);
  const rows = db
    .prepare(`SELECT block, log_index, tx_hash, contract, name, args, timestamp FROM chain_events
              WHERE batch_id = ? OR shipment_id IN (${shipmentIds.map(() => "?").join(",") || "NULL"})
              ORDER BY block, log_index`)
    .all(id, ...shipmentIds);
  res.json(rows.map((r) => ({ ...r, args: redactEventArgs(r.name, JSON.parse(r.args)) })));
}));

app.get("/api/batches/:id/affected", asyncRoute(async (req, res) => {
  res.json(await affectedParties(parseId(req.params.id)));
}));

app.get("/api/patients/:address/strips", asyncRoute(async (req, res) => {
  if (!isAddress(req.params.address, { strict: false })) throw httpError(400, "invalid address");
  const viewer = sessionAddress(req);
  if (!viewer) throw httpError(401, "sign in first");
  if (viewer.toLowerCase() !== req.params.address.toLowerCase()) throw httpError(403, "you can only see your own medicines");
  const rows = db
    .prepare(`SELECT args, tx_hash, timestamp FROM chain_events
              WHERE name = 'StripDispensed' AND lower(json_extract(args, '$.patient')) = lower(?)
              ORDER BY block DESC, log_index DESC`)
    .all(req.params.address);
  res.json(rows.map((r) => ({ ...JSON.parse(r.args), txHash: r.tx_hash, timestamp: r.timestamp })));
}));

app.get("/api/stats", asyncRoute(async (_req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  const [batches, devices] = await Promise.all([trustChain.read.batchCount(), monitor.read.getDevices()]);
  res.json({
    batches: Number(batches),
    shipments: count("SELECT COUNT(*) AS n FROM shipments"),
    inTransit: count("SELECT COUNT(*) AS n FROM shipments WHERE status = 'InTransit'"),
    stripsDispensed: count("SELECT COUNT(*) AS n FROM chain_events WHERE name = 'StripDispensed'"),
    devices: devices.length,
    telemetryReports: count("SELECT COUNT(*) AS n FROM reports WHERE status = 'confirmed'"),
    alerts: count("SELECT COUNT(*) AS n FROM alerts"),
    recalls: count("SELECT COUNT(*) AS n FROM alerts WHERE type = 'recall'"),
  });
}));

app.get("/api/alerts", asyncRoute(async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  const rows = db
    .prepare("SELECT * FROM alerts ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map((r) => ({ id: r.id, type: r.type, batchId: r.batch_id, shipmentId: r.shipment_id, txHash: r.tx_hash, createdAt: r.created_at, details: JSON.parse(r.details) }));
  const viewer = sessionAddress(req);
  res.json(await Promise.all(rows.map((a) => redactAlert(a, viewer))));
}));

app.get("/api/alerts/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const send = async (alert) => res.write(`event: alert\ndata: ${JSON.stringify(await redactAlert(alert, null))}\n\n`);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  bus.on("alert", send);
  req.on("close", () => {
    clearInterval(ping);
    bus.off("alert", send);
  });
});

registerAppRoutes(app, asyncRoute);
registerAiRoutes(app, asyncRoute);
registerSimRoutes(app, asyncRoute);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`TrustChain backend on :${config.port}  chain=${config.chainId}  trustChain=${config.trustChain}  monitor=${config.monitor}`);
  startIndexer();
  startRelayer();
});
