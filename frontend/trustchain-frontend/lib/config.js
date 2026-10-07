import { foundry, sepolia } from "viem/chains";
import deployments from "./generated/deployments.json";
import trustChainAbi from "./generated/TrustChain.abi.json";
import monitorAbi from "./generated/ColdChainMonitor.abi.json";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
export const IS_LOCAL = CHAIN_ID === 31337;

const localChain = {
  ...foundry,
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"] } },
};
export const chain = CHAIN_ID === sepolia.id ? sepolia : localChain;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0];

const dep = deployments[CHAIN_ID] ?? null;
export const DEPLOYED = Boolean(dep);
export const trustChain = { address: dep?.trustChain, abi: trustChainAbi };
export const coldChainMonitor = { address: dep?.coldChainMonitor, abi: monitorAbi };

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "642fa50e5635578138bb819b64fbcc30";
export const STORY_URL = "https://trustchain.hemeshkanyal.com";

export const explorerTx = (hash) => (chain.blockExplorers?.default ? `${chain.blockExplorers.default.url}/tx/${hash}` : null);
export const explorerAddress = (a) =>
  chain.blockExplorers?.default ? `${chain.blockExplorers.default.url}/address/${a}` : null;
