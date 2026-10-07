// Copy contract ABIs from the Foundry build (run `forge build` in ../blockchain first).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "..", "blockchain", "out");
const dest = join(root, "src", "abi");
mkdirSync(dest, { recursive: true });

for (const name of ["TrustChain", "ColdChainMonitor"]) {
  const { abi } = JSON.parse(readFileSync(join(out, `${name}.sol`, `${name}.json`), "utf8"));
  writeFileSync(join(dest, `${name}.json`), JSON.stringify(abi, null, 2) + "\n");
  console.log(`wrote src/abi/${name}.json (${abi.length} entries)`);
}
