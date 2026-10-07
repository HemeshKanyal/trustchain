"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { Toaster } from "sonner";
import { wagmiConfig } from "@/lib/wagmi";
import { NebulaProvider } from "@/components/fx/Nebula";
import { TxProvider } from "@/components/TxSheet";

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 4000, refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#2dd4bf", accentColorForeground: "#04060d", borderRadius: "medium" })}>
          <NebulaProvider>
            <TxProvider>
              {children}
              <Toaster theme="dark" position="bottom-left" richColors closeButton />
            </TxProvider>
          </NebulaProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
