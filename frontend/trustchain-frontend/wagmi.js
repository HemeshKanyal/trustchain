"use client";

import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// You can use your own WalletConnect Project ID (get one free at https://cloud.walletconnect.com)
// For now, we’ll put a placeholder
const WALLETCONNECT_PROJECT_ID = "642fa50e5635578138bb819b64fbcc30";

export const config = createConfig({
  chains: [sepolia], // ✅ change later to mainnet if needed
  connectors: [
    injected({ shimDisconnect: true }), // MetaMask / Browser wallets
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      showQrModal: true,
    }),
  ],
  transports: {
    [sepolia.id]: http(), // default public RPC
  },
});
