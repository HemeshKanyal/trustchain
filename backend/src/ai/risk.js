// Batch risk score (0–100) with the reasons behind it, from every signal TrustChain has.

const ORDER = { critical: 0, warning: 1, info: 2 };

/**
 * input: {
 *   batch: { status, expiresAt, conditions, rxOnly },           // on-chain
 *   trips: [{ shipmentId, monitored, analysis, anomaly }],      // cold chain per shipment
 *   clones: [{ codeHash, visitors }],                           // copied QR codes of this batch
 *   mismatches: number,                                         // wrong-batch strips found at receipt
 *   priceFindings: [finding],                                   // reported prices far from market
 *   now
 * }
 */
export function batchRisk({ batch, trips = [], clones = [], mismatches = 0, priceFindings = [], now = Math.floor(Date.now() / 1000) }) {
  const reasons = [];
  if (batch.status === 2) reasons.push({ code: "RECALLED", severity: "critical", text: "Recalled by the manufacturer or regulator.", weight: 100 });
  if (batch.status === 1) reasons.push({ code: "ON_HOLD", severity: "critical", text: "On hold pending the regulator's review.", weight: 40 });
  const daysLeft = (Number(batch.expiresAt) - now) / 86400;
  if (daysLeft <= 0) reasons.push({ code: "EXPIRED", severity: "critical", text: "Past its expiry date.", weight: 100 });
  else if (daysLeft <= 30) reasons.push({ code: "NEAR_EXPIRY", severity: "info", text: `Expires in ${Math.ceil(daysLeft)} days.`, weight: 5 });

  const cold = Number(batch.conditions?.maxTempX10 ?? 999) <= 80;
  for (const t of trips) {
    if (!t.monitored) {
      if (cold) reasons.push({ code: "UNMONITORED", severity: "warning", text: `Shipment #${t.shipmentId} of this cold-chain medicine travelled without a smart box.`, weight: 15 });
      continue;
    }
    if (t.status === "Delivered" && !t.analysis?.samples) {
      reasons.push({ code: "NO_TELEMETRY", severity: "warning", text: `Shipment #${t.shipmentId} had a smart box but it sent no readings, so its cold chain is unproven.`, weight: 15 });
      continue;
    }
    for (const f of t.analysis?.findings ?? []) {
      if (f.weight > 0) reasons.push({ ...f, text: `Shipment #${t.shipmentId}: ${f.text}` });
    }
    if (t.anomaly != null && t.anomaly > 0.62) {
      reasons.push({ code: "ANOMALY", severity: "warning", text: `Shipment #${t.shipmentId} behaved unlike other trips (anomaly score ${t.anomaly.toFixed(2)}).`, weight: 15 });
    }
  }
  if (clones.length) {
    const v = Math.max(...clones.map((c) => c.visitors));
    reasons.push({ code: "CLONE", severity: "critical", text: `Packaging scan mismatch: ${clones.length} sold strip code${clones.length > 1 ? "s were" : " was"} scanned again by up to ${v} different people, a sign of copied QR codes.`, weight: 30 });
  }
  if (mismatches) reasons.push({ code: "RECEIVE_MISMATCH", severity: "critical", text: `${mismatches} delivery check${mismatches > 1 ? "s" : ""} found strips from a different batch in the box.`, weight: 30 });
  for (const f of priceFindings) reasons.push(f);

  // The same signal from several reports counts once at its strongest, plus a little for repetition.
  const byCode = new Map();
  for (const r of reasons) {
    const cur = byCode.get(r.code);
    if (!cur) byCode.set(r.code, { ...r, repeats: 1 });
    else {
      cur.repeats++;
      if (r.weight > cur.weight) Object.assign(cur, r, { repeats: cur.repeats });
    }
  }
  const merged = [...byCode.values()];
  const raw = merged.reduce((s, r) => s + r.weight + Math.min(10, (r.repeats - 1) * 3), 0);
  const score = Math.min(100, Math.round(raw));
  merged.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.weight - a.weight);
  return {
    score,
    level: score >= 60 ? "high" : score >= 25 ? "medium" : "low",
    reasons: merged.map(({ code, severity, text, weight, repeats }) => ({ code, severity, text, weight, repeats })),
    signals: { trips: trips.length, monitoredTrips: trips.filter((t) => t.monitored).length, clones: clones.length, priceReports: priceFindings.length },
  };
}
