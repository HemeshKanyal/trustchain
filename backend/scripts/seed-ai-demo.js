// Plays out a month of realistic network activity on a LOCAL anvil chain that was started in the past
// (START_DAYS_AGO=30 e2e/reset-chain.sh), so TrustChain AI has real on-chain history to learn from:
//   - two medicines (cold-chain insulin 2–8°C, room-temperature paracetamol) with weekly sales patterns
//   - 12 monitored trips with signed smart-box readings, one heat excursion, one lid opening
//   - one cold-chain shipment sent without a box
//   node scripts/seed-ai-demo.js
import { createPublicClient, createTestClient, createWalletClient, http, keccak256, toHex, getAddress } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { readFileSync } from "node:fs";
import trustChainAbi from "../src/abi/TrustChain.json" with { type: "json" };
import { encodeDataHash, reportDomain, reportTypes, summarize } from "../src/telemetry.js";

const RPC = "http://127.0.0.1:8545";
const API = "http://localhost:4000";
const dep = JSON.parse(readFileSync(new URL("../../blockchain/deployments/31337.json", import.meta.url), "utf8"));
const tc = { address: dep.trustChain, abi: trustChainAbi };
const M = "test test test test test test test test test test test junk";
const who = { admin: mnemonicToAccount(M, { addressIndex: 0 }), maker: mnemonicToAccount(M, { addressIndex: 1 }), dist: mnemonicToAccount(M, { addressIndex: 2 }), pharm: mnemonicToAccount(M, { addressIndex: 3 }) };
const box = privateKeyToAccount("0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"); // emulator box (registered by reset-chain.sh)

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const test = createTestClient({ chain: foundry, mode: "anvil", transport: http(RPC) });
const wallet = (a) => createWalletClient({ account: a, chain: foundry, transport: http(RPC) });
let seed = 11;
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);

async function send(a, functionName, args) {
  const { request, result } = await pub.simulateContract({ ...tc, functionName, args, account: a });
  const hash = await wallet(a).writeContract(request);
  await pub.waitForTransactionReceipt({ hash });
  return result;
}
const chainNow = async () => Number((await pub.getBlock()).timestamp);
async function advance(seconds) {
  await test.increaseTime({ seconds });
  await test.mine({ blocks: 1 });
}

async function makeBatch(name, qty, cond) {
  const t = await chainNow();
  const id = await send(who.maker, "createBatch", [name, `TC-AI-${String(t).slice(-6)}-${name.slice(0, 3).toUpperCase()}`, qty, BigInt(t + 365 * 86400), false, cond, keccak256(toHex(name))]);
  const secrets = Array.from({ length: qty }, () => toHex(crypto.getRandomValues(new Uint8Array(32))));
  for (let i = 0; i < qty; i += 200) await send(who.maker, "registerStrips", [id, secrets.slice(i, i + 200).map((s) => keccak256(s))]);
  return { id: Number(id), secrets, cond };
}

let seq = Math.floor(Date.now() / 1000);
/** Ship with the box and post its signed readings for a 40-minute trip, then deliver. */
async function trip(from, to, batch, qty, profile = "normal") {
  const shipmentId = Number(await send(from, "createShipment", [BigInt(batch.id), to.address, qty, box.address]));
  const t0 = await chainNow();
  await advance(2600); // the trip happens; readings must not be "from the future" for the contract
  const mid = (batch.cond.minTempX10 + batch.cond.maxTempX10) / 2;
  for (let w = 0; w < 4; w++) {
    const samples = [];
    for (let k = 0; k < 6; k++) {
      const t = t0 + 30 + w * 600 + k * 100;
      let temp = Math.round(mid + (rand() - 0.5) * 12);
      let flags = 2;
      if (profile === "heat" && w >= 1 && w <= 2) temp = batch.cond.maxTempX10 + 70 + Math.round(rand() * 40);
      if (profile === "lid" && w === 2 && k < 3) flags |= 1;
      samples.push([t, temp, 450 + Math.round(rand() * 80), 28613900 + w * 9000, 77209000 + w * 7000, flags]);
    }
    const s = summarize(samples);
    const report = { shipmentId: BigInt(shipmentId), windowStart: BigInt(samples[0][0]), windowEnd: BigInt(samples.at(-1)[0]), ...s, dataHash: encodeDataHash(samples, []), seq: BigInt(++seq) };
    const signature = await box.signTypedData({ domain: reportDomain(31337, dep.coldChainMonitor), types: reportTypes, primaryType: "Report", message: report });
    const r = await fetch(`${API}/api/telemetry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device: box.address, report, signature, samples, rfid: [] }, (_, v) => (typeof v === "bigint" ? Number(v) : v)) });
    if (!r.ok) throw new Error(`telemetry ${r.status} ${await r.text()}`);
  }
  // let the relayer put this trip's readings on-chain before custody moves on
  for (let i = 0; i < 60; i++) {
    const h = await (await fetch(`${API}/api/health`)).json();
    if (!h.pendingReports) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  await send(to, "receiveShipment", [BigInt(shipmentId)]);
  return shipmentId;
}

console.log(`seeding history from ${new Date((await chainNow()) * 1000).toISOString().slice(0, 10)}`);
const insulin = await makeBatch("Insulin Glargine 100IU/ml", 400, { minTempX10: 20, maxTempX10: 80, maxHumidityX10: 700 });
const para = await makeBatch("Paracetamol 500mg tablets", 400, { minTempX10: 150, maxTempX10: 300, maxHumidityX10: 900 });

const trips = [];
const profiles = { 2: "heat", 4: "lid" }; // applied to factory→distributor legs (even slots)
let ti = 0;
async function restock(batch, qty) {
  const p = profiles[ti] ?? "normal";
  trips.push({ batch: batch.id, profile: p, id: await trip(who.maker, who.dist, batch, qty, p) });
  ti++;
  // A breach quarantines the batch on-chain; the regulator reviews it and releases it after a lab test.
  const b = await pub.readContract({ ...tc, functionName: "getBatch", args: [BigInt(batch.id)] });
  if (Number(b.status) === 1) await send(who.admin, "releaseQuarantine", [BigInt(batch.id), `Lab stability test passed after the ${p} event`]);
  trips.push({ batch: batch.id, profile: "normal", id: await trip(who.dist, who.pharm, batch, qty) });
  ti++;
}
const used = { [insulin.id]: 0, [para.id]: 0 };
await restock(insulin, 40);
await restock(para, 50);
const sold = { [insulin.id]: 0, [para.id]: 0 };

// Keep going until the chain catches up with the real date, so "yesterday" has real sales.
for (let d = 0; d < 60 && (await chainNow()) < Date.now() / 1000 - 86400; d++) {
  const dow = new Date((await chainNow()) * 1000).getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const plan = [
    [para, Math.max(0, Math.round((weekend ? 8 : 4) + (rand() - 0.5) * 3))],
    [insulin, Math.max(0, Math.round((weekend ? 3 : 2) + (rand() - 0.5) * 2))],
  ];
  for (const [b, n] of plan) {
    const have = Number(await pub.readContract({ ...tc, functionName: "balanceOf", args: [BigInt(b.id), who.pharm.address] }));
    if (have < n + 2) await restock(b, b === para ? 50 : 40); // keep the shelf stocked so sales reflect demand
    const take = Math.min(n, Number(await pub.readContract({ ...tc, functionName: "balanceOf", args: [BigInt(b.id), who.pharm.address] })));
    if (take > 0) {
      await send(who.pharm, "dispense", [b.secrets.slice(used[b.id], used[b.id] + take), "0x0000000000000000000000000000000000000000", 0n]);
      used[b.id] += take;
      sold[b.id] += take;
    }
  }
  await advance(86400 - 3000);
}
// a cold-chain shipment sent without a box (a compliance issue for the distributor)
await send(who.maker, "createShipment", [BigInt(insulin.id), who.dist.address, 10, "0x0000000000000000000000000000000000000000"]);

console.log(`batches: insulin #${insulin.id}, paracetamol #${para.id}`);
console.log(`trips: ${trips.length} (${trips.map((t) => `#${t.id}${t.profile !== "normal" ? ` ${t.profile}` : ""}`).join(", ")})`);
console.log(`dispensed: paracetamol ${sold[para.id]}, insulin ${sold[insulin.id]}`);
console.log(JSON.stringify({ insulin: insulin.id, para: para.id, heatTrip: trips.find((t) => t.profile === "heat").id, lidTrip: trips.find((t) => t.profile === "lid").id, paraSecret: para.secrets[0], pharmacy: getAddress(who.pharm.address) }));
