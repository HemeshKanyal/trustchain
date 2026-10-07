// TrustChain showcase simulator: fictional organisations, real transactions.
//   npm run sim                      (local anvil, fast "showcase" pace)
//   SIM_PRESET=live npm run sim      (Sepolia: real-time pace; needs SIM_FUNDER_KEY and an admin-registered regulator)
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../src/config.js";
import { sim } from "./config.js";
import { ORGS, PATIENTS } from "./world.js";
import { loadState, saveState, stateFile } from "./state.js";
import { Wallet, fund, mon, publicClient, tc, walletsFrom } from "./chain.js";
import { VirtualBox } from "./box.js";
import { Engine } from "./engine.js";
import { startControl } from "./control.js";

const events = [];
let eventSeq = 0;
function log(text, extra = {}) {
  const e = { id: ++eventSeq, at: Math.floor(Date.now() / 1000), kind: extra.kind ?? "info", text, ...extra };
  events.push(e);
  if (events.length > 500) events.shift();
  console.log(`[sim] ${new Date().toLocaleTimeString("en-GB")} ${text}`);
}

const state = loadState((await publicClient.getBlock({ blockNumber: config.deployBlock })).hash);
saveState(state);
const stats = state.counters;
const { at, account } = walletsFrom(state.mnemonic, stats);
const regulator = at(0, "Simulator regulator");
const orgs = Object.fromEntries(ORGS.map((o, i) => [o.id, { ...o, w: at(1 + i, o.name) }]));
const ROLE = { 2: "MFR", 3: "DST", 4: "PHM", 5: "DOC" };

log(`preset "${sim.preset}" on chain ${config.chainId}; state ${stateFile}`);

// ---- the regulator: the only admin the simulator holds
const isAdmin = await publicClient.readContract({ ...tc, functionName: "isAdmin", args: [regulator.address] });
if (!isAdmin) {
  if (config.chainId !== 31337) {
    console.error(`\nThe simulator's regulator wallet ${regulator.address} is not an admin.
As the contract owner, register it once (Admin role = 1):
  cast send ${config.trustChain} "registerParticipant(address,uint8,string,string,string)" \\
    ${regulator.address} 1 "TrustChain Simulator (regulator)" "Showcase network" "SIM-REG-1" \\
    --rpc-url $SEPOLIA_RPC_URL --account <your-keystore-name>\n`);
    process.exit(1);
  }
  // Local anvil only: the deployer is anvil's public account #0.
  const owner = new Wallet(privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"), "anvil owner", { tx: 0, gasWei: "0" });
  await fund([regulator], log);
  await owner.send(tc, "registerParticipant", [regulator.address, 1, "TrustChain Simulator (regulator)", "Showcase network", "SIM-REG-1"]);
  log(`registered simulator regulator ${regulator.address}`);
}

await fund([regulator, ...Object.values(orgs).map((o) => o.w)], log);

// ---- organisations
for (const o of Object.values(orgs)) {
  const p = await publicClient.readContract({ ...tc, functionName: "getParticipant", args: [o.w.address] });
  if (Number(p.role) === 0) {
    await regulator.send(tc, "registerParticipant", [o.w.address, o.role, o.name, `${o.city}, India`, `SIM-${ROLE[o.role]}-${o.id.split("-").pop().toUpperCase()}`]);
    log(`registered ${o.name} (${o.city})`);
  } else if (Number(p.role) !== o.role) {
    throw new Error(`${o.name}'s wallet ${o.w.address} already has another role on-chain`);
  }
}

// ---- smart boxes
const boxes = [];
for (let i = 0; i < sim.boxes; i++) {
  const acct = account(100 + i);
  const label = `SIM Box ${String(i + 1).padStart(2, "0")}`;
  const d = await publicClient.readContract({ ...mon, functionName: "getDevice", args: [acct.address] });
  if (!d.registeredAt) {
    await regulator.send(mon, "registerDevice", [acct.address, label]);
    log(`registered smart box ${label} ${acct.address}`);
  }
  boxes.push(new VirtualBox(acct, label, state, log));
}
const realBoxes = [];
for (const addr of sim.realBoxes) {
  if (await publicClient.readContract({ ...mon, functionName: "isActiveDevice", args: [addr] })) realBoxes.push(addr);
  else log(`real box ${addr} is not an active registered device; skipping it`);
}

const FIRST = ["Aarav", "Diya", "Kabir", "Ananya", "Vihaan", "Ira", "Reyansh", "Meera", "Arjun", "Saanvi", "Ishaan", "Tara"];
const patients = Array.from({ length: PATIENTS }, (_, i) => {
  const a = account(200 + i).address;
  return { address: a, name: `${FIRST[i % FIRST.length]} (sim patient ${i + 1})`, visitor: a.slice(2, 34).toLowerCase() };
});

const engine = new Engine({ state, regulator, orgs, boxes, realBoxes, patients, log });

// ---- status for the control API
async function status() {
  const local = config.chainId === 31337;
  const balances = local
    ? null
    : Object.fromEntries(await Promise.all([regulator, ...Object.values(orgs).map((o) => o.w)].map(async (w) => [w.address, formatEther(await publicClient.getBalance({ address: w.address }))])));
  return {
    running: true,
    paused: engine.paused,
    busy: [...engine.busy],
    preset: sim.preset,
    chainId: config.chainId,
    startedAt,
    counters: { ...stats, gasEth: formatEther(BigInt(stats.gasWei)) },
    regulator: regulator.address,
    orgs: Object.values(orgs).map((o) => ({ id: o.id, name: o.name, role: o.role, city: o.city, address: o.w.address, balance: balances?.[o.w.address] ?? null })),
    boxes: [...boxes.map((b) => ({ label: b.label, address: b.address, busy: b.busy, real: false })), ...engine.realBoxes.map((b) => ({ label: "Real ESP32", address: b.address, busy: b.busy, real: true }))],
    trips: Object.values(state.trips).map((t) => ({ id: t.id, from: orgs[t.fromId]?.name, to: orgs[t.toId]?.name, batchId: t.batchId, product: state.batches[t.batchId]?.product, qty: t.qty, km: t.km, box: t.box, startedAt: t.startedAt, endsAt: t.endsAt, cold: t.cold })),
    scenarios: ["heat", "lid", "sensor", "counterfeit-wave", "clone", "recall", "price-dump"],
  };
}
const startedAt = Math.floor(Date.now() / 1000);
startControl({ engine, status, events: (after) => events.filter((e) => e.id > after), log });

log(`network ready: ${Object.keys(orgs).length} organisations, ${boxes.length} virtual boxes${realBoxes.length ? ` + ${realBoxes.length} real` : ""}, ${patients.length} patients`);
await engine.run();
