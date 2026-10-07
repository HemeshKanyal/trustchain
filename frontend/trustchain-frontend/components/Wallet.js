"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { FlaskConical } from "lucide-react";
import { DEV_ACCOUNTS } from "@/lib/wagmi";
import { IS_LOCAL } from "@/lib/config";

/** Local chain only: act as any seeded demo account without a browser wallet (anvil accounts are unlocked). */
export function DevAccountPicker() {
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { address, connector } = useAccount();
  if (!IS_LOCAL) return null;
  const current = connector?.id?.startsWith("dev-") ? address : "";
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/[0.06] px-2 py-1 text-xs text-amber-200" title="Local test chain: switch between demo accounts">
      <FlaskConical className="h-3.5 w-3.5" />
      <select
        aria-label="Dev account"
        data-testid="dev-account"
        className="max-w-40 bg-transparent text-xs outline-none"
        value={current ?? ""}
        onChange={async (e) => {
          const target = connectors.find((c) => c.id === `dev-${e.target.value}`);
          if (address) await disconnectAsync();
          if (target) await connectAsync({ connector: target });
        }}
      >
        <option value="">Dev account…</option>
        {DEV_ACCOUNTS.map((a) => (
          <option key={a.address} value={a.address} className="bg-ink-900">
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WalletButton() {
  return <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />;
}
