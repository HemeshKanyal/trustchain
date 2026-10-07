// Checks TrustChain AI against the month seeded by seed-ai-demo.js, plus three live fraud signals.
//   node scripts/verify-ai.js '<json line printed by seed-ai-demo.js>'
import { keccak256 } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const API = "http://localhost:4000";
const S = JSON.parse(process.argv[2]);
const M = "test test test test test test test test test test test junk";
const acct = (i) => mnemonicToAccount(M, { addressIndex: i });
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
};
const j = async (path, init) => {
  const r = await fetch(API + path, init);
  return r.headers.get("content-type")?.includes("json") ? r.json() : r.text();
};
async function login(a) {
  const { message } = await j("/api/auth/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: a.address }) });
  const s = await j("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: a.address, message, signature: await a.signMessage({ message }) }) });
  return (path, body) => j(path, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}

console.log("\n1. Cold chain");
const heat = await j(`/api/ai/shipments/${S.heatTrip}/coldchain`);
check("heat trip: excursion found", heat.analysis.findings.some((f) => f.code === "TEMP_HIGH"), heat.analysis.findings.map((f) => f.text).join(" | "));
check("heat trip: MKT computed", heat.analysis.mkt != null, `MKT ${heat.analysis.mkt}°C, ${heat.analysis.excursionMinutes} min out of range`);
const lid = await j(`/api/ai/shipments/${S.lidTrip}/coldchain`);
check("lid trip: tamper found", lid.analysis.findings.some((f) => f.code === "TAMPER"));
const all = await Promise.all(Array.from({ length: 12 }, (_, i) => j(`/api/ai/shipments/${i + 1}/coldchain`)));
const scored = all.filter((t) => t.anomaly != null);
const others = scored.filter((t) => t.shipmentId !== S.heatTrip).map((t) => t.anomaly).sort((a, b) => a - b);
check("anomaly model trained on the trips", heat.anomalyModel === "isolation forest", `${heat.tripsModelled} trips`);
check("heat trip is the most anomalous", heat.anomaly >= Math.max(...others), `heat ${heat.anomaly?.toFixed(2)} vs others median ${others[others.length >> 1]?.toFixed(2)}, max ${Math.max(...others).toFixed(2)}`);

console.log("\n2. Demand forecasting");
const pharm = await login(acct(3));
const f = await pharm(`/api/ai/forecast?product=${encodeURIComponent("Paracetamol 500mg tablets")}&pharmacy=${S.pharmacy}&horizon=28`);
check("Holt-Winters on real history", f.method === "Holt-Winters (weekly)", `${f.historyDays} days of sales`);
check("back-test accuracy reported", f.backtest?.wape != null, `last 14 days within ${Math.round(f.backtest.wape * 100)}% (predicted ${f.backtest.predicted} vs actual ${f.backtest.actual})`);
const dow = (d) => new Date(d * 1000).getUTCDay();
const wk = f.forecast.filter((p) => [0, 6].includes(dow(p.day))).map((p) => p.mean);
const wd = f.forecast.filter((p) => ![0, 6].includes(dow(p.day))).map((p) => p.mean);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
check("weekend peak learned", avg(wk) > avg(wd) * 1.3, `weekend ${avg(wk).toFixed(1)}/day vs weekday ${avg(wd).toFixed(1)}/day`);
check("stock cover computed", f.stock != null, `${f.stock} in stock, ${f.daysOfCover == null ? "30+" : f.daysOfCover.toFixed(1)} days of cover, reorder ${f.reorder}`);
const anon = await j(`/api/ai/forecast?product=Paracetamol&pharmacy=${S.pharmacy}`);
check("another org can't see this pharmacy's stock", typeof anon === "object" && anon.error, anon.error);

console.log("\n3. Packaging scans: a copied code");
const code = keccak256(S.paraSecret);
for (const v of ["a1b2c3d4-0001", "a1b2c3d4-0002", "a1b2c3d4-0003"]) await j("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeHash: code, verdict: "dispensed", visitor: v }) });

console.log("4. Price far below market");
const ok = await pharm("/api/prices", { batchId: S.para, price: 2 });
check("market reference found for paracetamol (acetaminophen)", ok.market?.median > 0, `median ₹${ok.market?.median} from ${ok.market?.source}`);

console.log("5. Wrong strips in a box");
const dist = await login(acct(2));
const lastShipment = 13; // insulin sent without a box at the end of the seed
const rc = await dist("/api/receive-checks", { shipmentId: lastShipment, foundBatchId: S.para });
check("delivery check recorded as a mismatch", rc.ok === false);

await new Promise((r) => setTimeout(r, 11000)); // risk cache is 10 s
console.log("\n6. Batch risk");
const pr = await j(`/api/ai/batches/${S.para}/risk`);
const codes = pr.reasons.map((r) => r.code);
for (const c of ["TEMP_HIGH", "CLONE", "PRICE_LOW"]) check(`paracetamol risk includes ${c}`, codes.includes(c));
check("paracetamol scored high risk", pr.level === "high", `${pr.score}/100`);
pr.reasons.forEach((r) => console.log(`     · [${r.severity}] ${r.text}`));
const ir = await j(`/api/ai/batches/${S.insulin}/risk`);
const icodes = ir.reasons.map((r) => r.code);
for (const c of ["RECEIVE_MISMATCH", "UNMONITORED"]) check(`insulin risk includes ${c}`, icodes.includes(c));
ir.reasons.forEach((r) => console.log(`     · [${r.severity}] ${r.text}`));

console.log("\n7. Compliance");
const maker = await j(`/api/ai/orgs/${acct(1).address}/compliance`);
check("manufacturer penalised for an unmonitored cold shipment", maker.issues.some((i) => i.code === "UNMONITORED_COLD"), `${maker.grade} ${maker.score}: ${maker.issues.map((i) => i.text).join("; ")}`);
const pc = await j(`/api/ai/orgs/${S.pharmacy}/compliance`);
check("pharmacy penalised for the off-market price", pc.issues.some((i) => i.code === "PRICE_ANOMALY"), `${pc.grade} ${pc.score}`);

console.log("\n8. Regulator overview");
const admin = await login(acct(0));
const ov = await admin("/api/ai/overview");
check("overview ranks batches by risk", ov.batches[0].score >= ov.batches.at(-1).score, ov.batches.map((b) => `#${b.batchId} ${b.score}`).join(", "));
check("overview lists the copied code", ov.scans.clones.length > 0);
check("non-admins are refused", (await pharm("/api/ai/overview")).error === "admins only");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll AI checks passed");
process.exit(failed ? 1 : 0);
