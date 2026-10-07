import { db } from "./db.js";
import { trustChain } from "./chain.js";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Who is affected by a problem with `batchId`: current holders, open shipments, and patients who received strips. */
export async function affectedParties(batchId) {
  const shipments = db.prepare("SELECT * FROM shipments WHERE batch_id = ?").all(batchId);
  const parties = new Set();
  for (const s of shipments) {
    parties.add(s.from_addr);
    parties.add(s.to_addr);
  }

  const holders = [];
  for (const address of parties) {
    const balance = await trustChain.read.balanceOf([BigInt(batchId), address]);
    if (balance > 0n) {
      const p = await trustChain.read.getParticipant([address]);
      holders.push({ address, name: p.name, role: Number(p.role), balance: Number(balance) });
    }
  }

  const inTransit = shipments
    .filter((s) => s.status === "InTransit")
    .map((s) => ({ shipmentId: s.id, from: s.from_addr, to: s.to_addr, quantity: s.quantity }));

  const dispensed = db
    .prepare("SELECT args, tx_hash, timestamp FROM chain_events WHERE name = 'StripDispensed' AND batch_id = ?")
    .all(batchId)
    .map((r) => ({ ...JSON.parse(r.args), txHash: r.tx_hash, timestamp: r.timestamp }));
  const patients = [...new Set(dispensed.map((d) => d.patient).filter((p) => p && p !== ZERO))];

  return {
    holders,
    inTransit,
    patients,
    stripsDispensed: dispensed.length,
    anonymousStrips: dispensed.filter((d) => d.patient === ZERO).length,
  };
}
