import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;

const deploymentPath = resolve(root, env.DEPLOYMENT ?? "../blockchain/deployments/31337.json");
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));

export const config = {
  port: Number(env.PORT ?? 4000),
  rpcUrl: env.RPC_URL ?? "http://127.0.0.1:8545",
  chainId: Number(deployment.chainId),
  trustChain: deployment.trustChain,
  monitor: deployment.coldChainMonitor,
  deployBlock: BigInt(env.START_BLOCK ?? deployment.deployBlock ?? 0),
  relayerKey: env.RELAYER_PRIVATE_KEY || null,
  dbPath: resolve(root, env.DB_PATH ?? "data/trustchain.db"),
  windowSeconds: Number(env.WINDOW_SECONDS ?? 60),
  sampleSeconds: Number(env.SAMPLE_SECONDS ?? 10),
  logChunk: BigInt(env.LOG_CHUNK ?? 2000),
  confirmations: BigInt(env.CONFIRMATIONS ?? (Number(deployment.chainId) === 31337 ? 0 : 2)),
  pollMs: Number(env.POLL_MS ?? 4000),
  corsOrigin: env.CORS_ORIGIN ?? "*",
};
