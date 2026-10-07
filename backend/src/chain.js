import { createPublicClient, createWalletClient, defineChain, getContract, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, sepolia } from "viem/chains";
import { config } from "./config.js";
import trustChainAbi from "./abi/TrustChain.json" with { type: "json" };
import monitorAbi from "./abi/ColdChainMonitor.json" with { type: "json" };

export { trustChainAbi, monitorAbi };

const known = { [foundry.id]: foundry, [sepolia.id]: sepolia };
export const chain =
  known[config.chainId] ??
  defineChain({
    id: config.chainId,
    name: `chain-${config.chainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });

export const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });

export const relayerAccount = config.relayerKey ? privateKeyToAccount(config.relayerKey) : null;
export const walletClient = relayerAccount
  ? createWalletClient({ account: relayerAccount, chain, transport: http(config.rpcUrl) })
  : null;

export const trustChain = getContract({ address: config.trustChain, abi: trustChainAbi, client: publicClient });
export const monitor = getContract({ address: config.monitor, abi: monitorAbi, client: publicClient });

export const ShipmentStatus = ["None", "InTransit", "Delivered", "Cancelled"];
