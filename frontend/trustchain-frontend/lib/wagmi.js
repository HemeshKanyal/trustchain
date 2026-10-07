import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, walletConnectWallet, coinbaseWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { devAccount } from "./devConnector";
import { chain, IS_LOCAL, RPC_URL, WC_PROJECT_ID } from "./config";

/** Anvil's default unlocked accounts, with the roles SeedDemo gives them. Local chain only. */
export const DEV_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", label: "Admin (network owner)" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", label: "Acme Pharma (manufacturer)" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", label: "FastCold Logistics (distributor)" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", label: "City Care Pharmacy" },
  { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", label: "Dr. Ananya Rao (doctor)" },
  { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", label: "Patient" },
  { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", label: "New user (no role)" },
];

const walletConnectors = connectorsForWallets(
  [{ groupName: "Wallets", wallets: [metaMaskWallet, injectedWallet, coinbaseWallet, walletConnectWallet] }],
  { appName: "TrustChain", projectId: WC_PROJECT_ID },
);

const devConnectors = IS_LOCAL ? DEV_ACCOUNTS.map((a) => devAccount({ address: a.address, label: a.label, rpcUrl: RPC_URL })) : [];

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [...walletConnectors, ...devConnectors],
  transports: { [chain.id]: http(RPC_URL) },
  ssr: true,
});
