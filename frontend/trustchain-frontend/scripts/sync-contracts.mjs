// Copy ABIs (from the Foundry build) and deployment addresses into lib/generated/.
//   cd ../../blockchain && forge build && cd - && npm run sync
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chainDir = join(root, "..", "..", "blockchain");
const dest = join(root, "lib", "generated");
mkdirSync(dest, { recursive: true });

for (const name of ["TrustChain", "ColdChainMonitor"]) {
  const { abi } = JSON.parse(readFileSync(join(chainDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
  writeFileSync(join(dest, `${name}.abi.json`), JSON.stringify(abi, null, 2) + "\n");
}

const deployments = {};
const depDir = join(chainDir, "deployments");
if (existsSync(depDir)) {
  for (const f of readdirSync(depDir).filter((f) => /^\d+\.json$/.test(f))) {
    const d = JSON.parse(readFileSync(join(depDir, f), "utf8"));
    deployments[d.chainId] = { trustChain: d.trustChain, coldChainMonitor: d.coldChainMonitor, deployBlock: d.deployBlock };
  }
}
writeFileSync(join(dest, "deployments.json"), JSON.stringify(deployments, null, 2) + "\n");
console.log(`synced ABIs + deployments for chains: ${Object.keys(deployments).join(", ") || "(none)"}`);
