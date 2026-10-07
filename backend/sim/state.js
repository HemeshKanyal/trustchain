// Simulator memory that must survive restarts (strip secrets are only known here and in labels).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateMnemonic, english } from "viem/accounts";
import { config } from "../src/config.js";

const dir = dirname(config.dbPath);
const FILE = resolve(dir, `sim-state-${config.chainId}.json`);
mkdirSync(dir, { recursive: true });

const fresh = () => ({
  chainId: config.chainId,
  contract: config.trustChain,
  mnemonic: generateMnemonic(english), // the simulator's own wallets: never anvil's public keys
  registered: {},
  boxesRegistered: [],
  batches: {}, // batchId -> { product, maker, secrets: [], next: 0 }
  boxSeq: {}, // device address -> last report seq
  counters: { tx: 0, gasWei: "0", reports: 0, sales: 0, trips: 0, prescriptions: 0, scans: 0 },
});

/** chainMark: hash of the deploy block. A redeploy, or a reset local chain at the same addresses, means a new world. */
export function loadState(chainMark) {
  if (!existsSync(FILE)) return { ...fresh(), chainMark };
  const s = JSON.parse(readFileSync(FILE, "utf8"));
  if (s.contract?.toLowerCase() !== config.trustChain.toLowerCase() || s.chainMark !== chainMark) return { ...fresh(), chainMark, mnemonic: s.mnemonic };
  for (const [id, rv] of Object.entries(s.reviews ?? {})) if (typeof rv === "number") s.reviews[id] = { due: rv, flags: 3 };
  return s;
}

let timer = null;
export function saveState(s) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    writeFileSync(`${FILE}.tmp`, JSON.stringify(s));
    renameSync(`${FILE}.tmp`, FILE);
  }, 300);
}
export const stateFile = FILE;
