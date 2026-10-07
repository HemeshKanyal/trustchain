// Software smart-box: same protocol and signatures as the ESP32 tracker firmware.
//
//   node scripts/emulator.js [--backend http://localhost:4000] [--key 0x...] [--scenario normal|heat|cold|humid|lid|sensor-fault]
//                            [--fault-after 2]   (windows before the fault starts)
//
// Without --key, a key is generated once and saved to data/emulator-key.txt.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { encodeDataHash, FLAG_GPS_FIX, FLAG_LID_OPEN, HUM_INVALID, reportDomain, reportTypes, summarize, TEMP_INVALID } from "../src/telemetry.js";

const { values: opt } = parseArgs({
  options: {
    backend: { type: "string", default: "http://localhost:4000" },
    key: { type: "string" },
    scenario: { type: "string", default: "normal" },
    "fault-after": { type: "string", default: "2" },
  },
});

function loadKey() {
  if (opt.key) return opt.key;
  const file = "data/emulator-key.txt";
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync("data", { recursive: true });
  const k = generatePrivateKey();
  writeFileSync(file, k + "\n", { mode: 0o600 });
  return k;
}

const account = privateKeyToAccount(loadKey());
const faultAfter = Number(opt["fault-after"]);
const ROUTE = [[28.6139, 77.209], [25.4358, 81.8463], [23.2599, 77.4126], [21.1458, 79.0882], [19.076, 72.8777]];

let cfg = null;
let seq = 0;
let windowsSent = 0;
let win = { start: 0, samples: [], rfid: [] };
let step = 0;
const now = () => Math.floor(Date.now() / 1000);

async function fetchConfig() {
  const r = await fetch(`${opt.backend}/api/devices/${account.address}/config`);
  if (!r.ok) throw new Error(`config ${r.status}`);
  const next = await r.json();
  if (next.shipmentId !== cfg?.shipmentId) {
    console.log(`[cfg] shipment ${cfg?.shipmentId ?? "none"} -> ${next.shipmentId ?? "none"}${next.registered ? "" : "  (device NOT registered on-chain)"}`);
    win = { start: now(), samples: [], rfid: [] };
    windowsSent = 0;
  }
  cfg = next;
}

function position() {
  const n = ROUTE.length - 1;
  const p = Math.min((step * 0.01) % (n + 1), n);
  const i = Math.min(Math.floor(p), n - 1);
  const f = p - i;
  const lat = ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f;
  const lon = ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f;
  return [Math.round(lat * 1e6), Math.round(lon * 1e6)];
}

function takeSample() {
  const c = cfg.conditions ?? { minTempX10: 20, maxTempX10: 80, maxHumidityX10: 700 };
  const mid = (c.minTempX10 + c.maxTempX10) / 2;
  const faulty = windowsSent >= faultAfter;
  let temp = Math.round(mid + (Math.random() - 0.5) * 10);
  let hum = Math.round(450 + Math.random() * 50);
  let flags = FLAG_GPS_FIX;
  if (faulty) {
    if (opt.scenario === "heat") temp = c.maxTempX10 + 40 + Math.round(Math.random() * 30);
    if (opt.scenario === "cold") temp = c.minTempX10 - 30;
    if (opt.scenario === "humid") hum = (c.maxHumidityX10 || 700) + 100;
    if (opt.scenario === "lid") flags |= FLAG_LID_OPEN;
    if (opt.scenario === "sensor-fault") [temp, hum] = [TEMP_INVALID, HUM_INVALID];
  }
  const [lat, lon] = position();
  step++;
  win.samples.push([now(), temp, hum, lat, lon, flags]);
  const shown = temp === TEMP_INVALID ? "ERR" : `${(temp / 10).toFixed(1)}C`;
  console.log(`[sample] ${shown} ${hum === HUM_INVALID ? "ERR" : (hum / 10).toFixed(1) + "%"} ${(lat / 1e6).toFixed(4)},${(lon / 1e6).toFixed(4)}${flags & FLAG_LID_OPEN ? " LID OPEN" : ""}`);
}

async function closeWindow() {
  const end = now();
  if (!win.samples.length) return;
  const s = summarize(win.samples);
  const report = {
    shipmentId: BigInt(cfg.shipmentId),
    windowStart: BigInt(win.start),
    windowEnd: BigInt(end),
    ...s,
    dataHash: encodeDataHash(win.samples, win.rfid),
    seq: BigInt(++seq),
  };
  const signature = await account.signTypedData({
    domain: reportDomain(cfg.chainId, cfg.monitor),
    types: reportTypes,
    primaryType: "Report",
    message: report,
  });
  const body = JSON.stringify(
    { device: account.address, report, signature, samples: win.samples, rfid: win.rfid },
    (_, v) => (typeof v === "bigint" ? Number(v) : v),
  );
  win = { start: end, samples: [], rfid: [] };
  windowsSent++;
  const r = await fetch(`${opt.backend}/api/telemetry`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  console.log(`[report] seq=${report.seq} temp ${s.minTempX10 / 10}..${s.maxTempX10 / 10}C tamper=${s.tamper} -> ${r.status} ${await r.text()}`);
}

console.log(`Emulated device ${account.address}  scenario=${opt.scenario}  backend=${opt.backend}`);
seq = Math.floor(Date.now() / 1000); // seq must only increase across restarts; unix time is a cheap monotonic base
let lastCfg = 0;
let lastSample = 0;
for (;;) {
  try {
    if (Date.now() - lastCfg > 5000) {
      await fetchConfig();
      lastCfg = Date.now();
    }
    if (cfg && Date.now() - lastSample >= cfg.sampleSeconds * 1000) {
      lastSample = Date.now();
      if (cfg.shipmentId) takeSample();
    }
    if (cfg?.shipmentId && now() - win.start >= cfg.windowSeconds) await closeWindow();
  } catch (e) {
    console.error("[error]", e.message);
  }
  await new Promise((r) => setTimeout(r, 250));
}
