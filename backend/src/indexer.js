// Follows TrustChain + ColdChainMonitor logs into SQLite and raises alerts.
import { config } from "./config.js";
import { db, getMeta, setMeta, transaction } from "./db.js";
import { monitorAbi, publicClient, trustChainAbi } from "./chain.js";
import { affectedParties } from "./affected.js";
import { bus } from "./events.js";

const events = [...trustChainAbi, ...monitorAbi].filter((x) => x.type === "event");

const json = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const REASONS = { 1: "temperature below range", 2: "temperature above range", 4: "humidity above limit", 8: "tamper / sensor fault", 16: "manual (admin)" };
export const reasonText = (flags) =>
  Object.entries(REASONS).filter(([bit]) => Number(flags) & Number(bit)).map(([, t]) => t);

const insertEvent = db.prepare(`INSERT OR IGNORE INTO chain_events
  (block, log_index, tx_hash, contract, name, batch_id, shipment_id, args, timestamp) VALUES (?,?,?,?,?,?,?,?,?)`);
const insertShipment = db.prepare(`INSERT OR IGNORE INTO shipments
  (id, batch_id, from_addr, to_addr, quantity, device, status, created_block) VALUES (?,?,?,?,?,?,?,?)`);
const setShipmentStatus = db.prepare("UPDATE shipments SET status = ? WHERE id = ?");
const insertAlert = db.prepare(`INSERT OR IGNORE INTO alerts (type, batch_id, shipment_id, details, tx_hash, created_at)
  VALUES (?,?,?,?,?,?)`);

const alertedBreach = db.prepare(
  "SELECT 1 FROM alerts WHERE type = 'breach' AND shipment_id = ? AND json_extract(details, '$.reasonFlags') = ?",
);

async function raiseAlert(type, { batchId, shipmentId = null, txHash, details, at }) {
  const affected = batchId != null ? await affectedParties(batchId) : null;
  const full = { ...details, affected };
  const res = insertAlert.run(type, batchId, shipmentId, json(full), txHash, at ?? Math.floor(Date.now() / 1000));
  if (res.changes) {
    const alert = { id: Number(res.lastInsertRowid), type, batchId, shipmentId, txHash, details: full };
    bus.emit("alert", alert);
    console.log(`[alert] ${type} batch=${batchId} shipment=${shipmentId ?? "-"}`);
  }
}

async function handleAlerts(log, at) {
  const a = log.args;
  const when = { txHash: log.transactionHash, at };
  switch (log.eventName) {
    case "BreachDetected":
      // One alert per shipment per breach type; every report is still recorded in `reports`.
      if (alertedBreach.get(Number(a.shipmentId), Number(a.reasonFlags))) return;
      return raiseAlert("breach", {
        batchId: Number(a.batchId),
        shipmentId: Number(a.shipmentId),
        ...when,
        details: { reasonFlags: Number(a.reasonFlags), reasons: reasonText(a.reasonFlags), seq: Number(a.seq) },
      });
    case "BatchQuarantined":
      // Monitor-triggered quarantines are already reported as "breach".
      if (a.by.toLowerCase() === config.monitor.toLowerCase()) return;
      return raiseAlert("quarantine", {
        batchId: Number(a.batchId),
        shipmentId: Number(a.shipmentId) || null,
        ...when,
        details: { reasonFlags: Number(a.reasonFlags), reasons: reasonText(a.reasonFlags), by: a.by },
      });
    case "BatchRecalled":
      return raiseAlert("recall", {
        batchId: Number(a.batchId),
        ...when,
        details: { reason: a.reason, by: a.by },
      });
    case "QuarantineReleased":
      return raiseAlert("quarantine_released", {
        batchId: Number(a.batchId),
        ...when,
        details: { note: a.note, by: a.by },
      });
  }
}

function applyState(log) {
  const a = log.args;
  if (log.eventName === "ShipmentCreated") {
    insertShipment.run(
      Number(a.shipmentId), Number(a.batchId), a.from, a.to, Number(a.quantity),
      a.device === "0x0000000000000000000000000000000000000000" ? null : a.device.toLowerCase(),
      "InTransit", Number(log.blockNumber),
    );
  } else if (log.eventName === "ShipmentDelivered") {
    setShipmentStatus.run("Delivered", Number(a.shipmentId));
  } else if (log.eventName === "ShipmentCancelled") {
    setShipmentStatus.run("Cancelled", Number(a.shipmentId));
  }
}

async function syncOnce() {
  const head = (await publicClient.getBlockNumber()) - config.confirmations;
  let from = BigInt(getMeta("indexedBlock", (config.deployBlock - 1n).toString())) + 1n;
  while (from <= head) {
    const to = from + config.logChunk - 1n > head ? head : from + config.logChunk - 1n;
    const logs = await publicClient.getLogs({
      address: [config.trustChain, config.monitor],
      events,
      fromBlock: from,
      toBlock: to,
      strict: true,
    });

    const blockTimes = new Map();
    for (const bn of new Set(logs.map((l) => l.blockNumber))) {
      blockTimes.set(bn, Number((await publicClient.getBlock({ blockNumber: bn })).timestamp));
    }

    transaction(() => {
      for (const log of logs) {
        const a = log.args;
        insertEvent.run(
          Number(log.blockNumber), log.logIndex, log.transactionHash,
          log.address.toLowerCase() === config.monitor.toLowerCase() ? "ColdChainMonitor" : "TrustChain",
          log.eventName,
          a.batchId != null ? Number(a.batchId) : null,
          a.shipmentId != null ? Number(a.shipmentId) : null,
          json(a),
          blockTimes.get(log.blockNumber),
        );
        applyState(log);
      }
      setMeta("indexedBlock", to);
    });
    for (const log of logs) await handleAlerts(log, blockTimes.get(log.blockNumber));
    if (logs.length) console.log(`[indexer] blocks ${from}-${to}: ${logs.length} events`);
    from = to + 1n;
  }
}

export function startIndexer() {
  const loop = async () => {
    try {
      await syncOnce();
    } catch (e) {
      console.error("[indexer]", e.shortMessage ?? e.message);
    }
    setTimeout(loop, config.pollMs);
  };
  loop();
}
