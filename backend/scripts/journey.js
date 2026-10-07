// End-to-end medicine journey on a LOCAL anvil chain: factory → distributor → pharmacy → patient,
// with a real (or emulated) smart box riding along, then counterfeit / clone / recall checks.
// Every step is asserted; the script exits non-zero if anything does not behave as designed.
//
//   node scripts/journey.js 0x<DEVICE_ADDRESS> [--report-wait 120]
//
// Needs: anvil running with Deploy + SeedDemo applied, the device registered, and the backend running.
import { parseArgs } from "node:util";
import { createWalletClient, http, keccak256, toHex, BaseError, ContractFunctionRevertedError } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { config } from "../src/config.js";
import { chain, publicClient, trustChainAbi } from "../src/chain.js";

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { "report-wait": { type: "string", default: "120" } },
});
const DEVICE = positionals[0];
if (!DEVICE) throw new Error("usage: node scripts/journey.js 0x<DEVICE_ADDRESS>");
if (config.chainId !== 31337) throw new Error("journey.js uses anvil dev keys: local chain only");

const API = `http://localhost:${config.port}`;
const MNEMONIC = "test test test test test test test test test test test junk";
const acct = (i) => mnemonicToAccount(MNEMONIC, { addressIndex: i });
const actors = { manufacturer: acct(1), distributor: acct(2), pharmacy: acct(3), doctor: acct(4), patient: acct(5), stranger: acct(9) };
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(config.rpcUrl) });
const tc = { address: config.trustChain, abi: trustChainAbi };

const VERDICT = ["Unknown (counterfeit)", "Genuine", "Already dispensed", "Recalled", "Quarantined", "Expired"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let step = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}
const title = (t) => console.log(`\n${++step}. ${t}`);

async function send(who, functionName, args) {
  const { request, result } = await publicClient.simulateContract({ ...tc, functionName, args, account: actors[who] });
  const hash = await wallet(actors[who]).writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  console.log(`   tx ${hash.slice(0, 18)}… block ${receipt.blockNumber}  (${who}.${functionName})`);
  return result;
}

async function expectRevert(who, functionName, args, errorName) {
  try {
    await publicClient.simulateContract({ ...tc, functionName, args, account: actors[who] });
    return { reverted: false };
  } catch (e) {
    const r = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    return { reverted: r?.data?.errorName === errorName, got: r?.data?.errorName ?? e.shortMessage };
  }
}

const read = (functionName, args = []) => publicClient.readContract({ ...tc, functionName, args });
const getJson = async (path) => (await fetch(`${API}${path}`)).json();
const codeHash = (secret) => keccak256(secret);
const randomSecret = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

async function waitForBoxReports(shipmentId, want) {
  const deadline = Date.now() + Number(opt["report-wait"]) * 1000;
  process.stdout.write(`   waiting for the smart box to report on shipment #${shipmentId} `);
  while (Date.now() < deadline) {
    const { reports } = await getJson(`/api/shipments/${shipmentId}/telemetry`);
    const done = reports.filter((r) => r.status === "confirmed");
    if (done.length >= want) {
      console.log("");
      return done;
    }
    process.stdout.write(".");
    await sleep(3000);
  }
  console.log("");
  return (await getJson(`/api/shipments/${shipmentId}/telemetry`)).reports.filter((r) => r.status === "confirmed");
}

async function waitForIndexer() {
  const head = await publicClient.getBlockNumber();
  for (let i = 0; i < 30; i++) {
    const { indexedBlock } = await getJson("/api/health");
    if (BigInt(indexedBlock ?? 0) >= head) return;
    await sleep(1000);
  }
}

// ---------------------------------------------------------------------------------------------

console.log(`TrustChain medicine journey  chain=${config.chainId}  contract=${config.trustChain}`);
console.log(`Smart box: ${DEVICE}`);

title("Manufacturer creates a batch of 10 serialised, prescription-only strips");
const now = BigInt(Math.floor(Date.now() / 1000));
const lot = `TC-IN-2026-${String(Date.now()).slice(-7)}`;
await send("manufacturer", "createBatch", [
  "Amoxicillin 500mg", lot, 10, now + 365n * 86400n, true,
  { minTempX10: 20, maxTempX10: 450, maxHumidityX10: 900 }, keccak256(toHex("amoxicillin-500-coa")),
]);
const batchId = await read("batchCount");
const secrets = Array.from({ length: 10 }, randomSecret);
await send("manufacturer", "registerStrips", [batchId, secrets.map(codeHash)]);
const b = await read("getBatch", [batchId]);
check("batch recorded on-chain", b.productName === "Amoxicillin 500mg" && b.stripsRegistered === 10, `batch #${batchId}, lot ${lot}`);
check("manufacturer holds all 10 strips", (await read("balanceOf", [batchId, actors.manufacturer.address])) === 10n);
console.log(`   QR on strip #1: TC1:${secrets[0]}`);

title("Unregistered wallet tries to create a fake batch");
const fake = await expectRevert("stranger", "createBatch", ["Fake Amox", "X", 10, now + 1000n, false, { minTempX10: 0, maxTempX10: 1, maxHumidityX10: 0 }, toHex(0, { size: 32 })], "WrongRole");
check("rejected: only registered manufacturers can mint batches", fake.reverted, fake.got);

title("Manufacturer ships to distributor inside the smart box");
await send("manufacturer", "createShipment", [batchId, actors.distributor.address, 10, DEVICE]);
const leg1 = await read("shipmentCount");
check("custody left the manufacturer, in transit (not yet received)",
  (await read("balanceOf", [batchId, actors.manufacturer.address])) === 0n && (await read("balanceOf", [batchId, actors.distributor.address])) === 0n,
  `shipment #${leg1}`);
const r1 = await waitForBoxReports(leg1, 2);
check("smart box reported this leg on-chain (device-signed)", r1.length >= 2,
  r1.map((r) => `${r.min_temp_x10 / 10}–${r.max_temp_x10 / 10}°C${r.tamper ? " TAMPER" : ""}`).join(", ") || "no reports");
check("no cold-chain breach on this leg", r1.every((r) => !r.breach_flags));

title("Distributor confirms receipt");
await send("distributor", "receiveShipment", [leg1]);
check("distributor now holds 10 strips", (await read("balanceOf", [batchId, actors.distributor.address])) === 10n);

title("Distributor ships 10 strips to City Care Pharmacy (smart box again)");
await send("distributor", "createShipment", [batchId, actors.pharmacy.address, 10, DEVICE]);
const leg2 = await read("shipmentCount");
const r2 = await waitForBoxReports(leg2, 2);
check("smart box reported this leg on-chain", r2.length >= 2,
  r2.map((r) => `${r.min_temp_x10 / 10}–${r.max_temp_x10 / 10}°C${r.tamper ? " TAMPER" : ""}`).join(", ") || "no reports");
check("no cold-chain breach on this leg", r2.every((r) => !r.breach_flags));
await send("pharmacy", "receiveShipment", [leg2]);
check("pharmacy holds 10 strips", (await read("balanceOf", [batchId, actors.pharmacy.address])) === 10n);

title("Doctor prescribes 2 strips to the patient");
await send("doctor", "issuePrescription", [actors.patient.address, keccak256(toHex("Amoxicillin 500mg TDS x 5 days")), now + 7n * 86400n, 2]);
const rx = await read("prescriptionCount");
check("prescription on-chain", await read("isPrescriptionUsable", [rx]), `Rx #${rx} for ${actors.patient.address.slice(0, 10)}…`);

title("Patient scans strip #1 at the counter (no wallet needed)");
let v = await read("verify", [codeHash(secrets[0])]);
check("verdict: Genuine", v.verdict === 1, `${v.productName}, lot ${v.lotNumber}, by ${v.manufacturerName}, expires ${new Date(Number(v.expiresAt) * 1000).toDateString()}`);

title("Someone scans a counterfeit strip with a made-up QR");
v = await read("verify", [codeHash(randomSecret())]);
check("verdict: Unknown (counterfeit)", v.verdict === 0);

title("Pharmacy tries to sell the prescription-only medicine without a prescription");
const noRx = await expectRevert("pharmacy", "dispense", [[secrets[0]], actors.patient.address, 0n], "PrescriptionRequired");
check("blocked on-chain", noRx.reverted, noRx.got);

title("Pharmacy dispenses strips #1 and #2 against the prescription");
await send("pharmacy", "dispense", [[secrets[0], secrets[1]], actors.patient.address, rx]);
check("pharmacy stock 10 → 8", (await read("balanceOf", [batchId, actors.pharmacy.address])) === 8n);
check("prescription fully used", !(await read("isPrescriptionUsable", [rx])));

title("A cloned copy of strip #1's QR turns up later");
v = await read("verify", [codeHash(secrets[0])]);
check("verdict: Already dispensed (clone detected)", v.verdict === 2, `sold by ${v.dispensedByName} on ${new Date(Number(v.dispensedAt) * 1000).toLocaleString()}`);
const clone = await expectRevert("pharmacy", "dispense", [[secrets[0]], actors.patient.address, 0n], "StripNotDispensable");
check("cloned strip cannot be sold again", clone.reverted, clone.got);

title("Manufacturer finds a contamination issue and recalls the batch");
await waitForIndexer();
await send("manufacturer", "recallBatch", [batchId, "Contamination found in QC retest"]);
let recall = null;
for (let i = 0; i < 20 && !recall; i++) {
  await sleep(1000);
  recall = (await getJson("/api/alerts?limit=20")).find((a) => a.type === "recall" && a.batchId === Number(batchId));
}
check("recall alert raised by the backend", Boolean(recall));
if (recall) {
  const a = recall.details.affected;
  check("alert targets exactly the affected patient", a.patients.length === 1 && a.patients[0].toLowerCase() === actors.patient.address.toLowerCase(),
    `${a.patients.length} patient(s), ${a.stripsDispensed} strips dispensed`);
  check("alert lists the pharmacy still holding stock", a.holders.some((h) => h.address.toLowerCase() === actors.pharmacy.address.toLowerCase() && h.balance === 8),
    a.holders.map((h) => `${h.name}: ${h.balance}`).join(", "));
}
const afterRecall = await expectRevert("pharmacy", "dispense", [[secrets[2]], actors.patient.address, 0n], "BatchNotActive");
check("pharmacy blocked from dispensing recalled stock", afterRecall.reverted, afterRecall.got);
v = await read("verify", [codeHash(secrets[2])]);
check("unsold strip #3 now verifies as Recalled", v.verdict === 3);

title("Full custody history from the chain (via backend index)");
await waitForIndexer();
const timeline = await getJson(`/api/batches/${batchId}/timeline`);
const names = { [actors.manufacturer.address]: "Acme Pharma", [actors.distributor.address]: "FastCold Logistics", [actors.pharmacy.address]: "City Care Pharmacy" };
const who = (a) => names[a] ?? (a ? `${a.slice(0, 8)}…` : "");
for (const e of timeline) {
  const t = new Date(e.timestamp * 1000).toLocaleTimeString();
  const a = e.args;
  const describe = {
    BatchCreated: () => `batch created: ${a.productName} lot ${a.lotNumber}, ${a.quantity} strips`,
    StripsRegistered: () => `${a.count} strip QR codes registered`,
    ShipmentCreated: () => `shipment #${a.shipmentId}: ${who(a.from)} → ${who(a.to)}, ${a.quantity} strips, box ${a.device.slice(0, 8)}…`,
    ShipmentDelivered: () => `shipment #${a.shipmentId} received by ${who(a.to)}`,
    TelemetryRecorded: () => `  box report seq ${a.seq}: ${a.minTempX10 / 10}–${a.maxTempX10 / 10}°C, ≤${a.maxHumidityX10 / 10}%RH${a.tamper ? ", TAMPER" : ""}`,
    StripDispensed: () => `strip ${a.codeHash.slice(0, 10)}… dispensed by ${who(a.pharmacy)} to patient ${a.patient.slice(0, 8)}… (Rx #${a.prescriptionId})`,
    BatchRecalled: () => `RECALLED: ${a.reason}`,
    BreachDetected: () => `  BREACH on shipment #${a.shipmentId} (flags ${a.reasonFlags})`,
  };
  const line = describe[e.name]?.() ?? e.name;
  console.log(`   ${t}  ${line}`);
}
check("history covers every custody step", ["BatchCreated", "ShipmentCreated", "ShipmentDelivered", "TelemetryRecorded", "StripDispensed", "BatchRecalled"].every((n) => timeline.some((e) => e.name === n)),
  `${timeline.length} on-chain events`);

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed${passed === results.length ? " — medicine fully tracked factory → patient" : ""}`);
