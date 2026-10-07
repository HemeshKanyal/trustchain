import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Every run starts from a fresh local chain + backend. E2E_BOX=0x… also registers a real smart box. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_RESET) return;
  const script = join(dirname(fileURLToPath(import.meta.url)), "reset-chain.sh");
  execFileSync(script, process.env.E2E_BOX ? [process.env.E2E_BOX] : [], { stdio: "inherit" });
}
