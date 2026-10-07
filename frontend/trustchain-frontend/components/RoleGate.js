"use client";
import Link from "next/link";
import { Lock, Wallet, UserX } from "lucide-react";
import { useMe } from "@/lib/hooks";
import { ROLES, ROLE_PATH } from "@/lib/format";
import { Empty, Spinner, Button } from "./ui";
import { WalletButton } from "./Wallet";

/** Renders children only for an active participant with `role` (admins pass role=1; owner always passes as admin). */
export default function RoleGate({ role, children }) {
  const me = useMe();
  if (!me.isConnected)
    return (
      <div className="card">
        <Empty icon={Wallet} title="Connect your wallet">
          <div className="mt-3 flex justify-center">
            <WalletButton />
          </div>
        </Empty>
      </div>
    );
  if (me.loading) return <Spinner />;
  const ok = role === 1 ? me.isAdmin : me.role === role && me.active;
  if (ok) return children(me);
  if (me.role === role && !me.active)
    return (
      <div className="card">
        <Empty icon={UserX} title="Account suspended">
          An admin has suspended this {ROLES[role].toLowerCase()} account. Contact the network admin.
        </Empty>
      </div>
    );
  return (
    <div className="card">
      <Empty icon={Lock} title={`This page is for ${ROLES[role].toLowerCase()}s`}>
        {me.role ? (
          <>
            Your account is registered as <b>{ROLES[me.role]}</b>.{" "}
            <Link className="text-brand underline" href={ROLE_PATH[me.role]}>
              Go to your dashboard
            </Link>
          </>
        ) : (
          <>
            Your account has no role yet.
            <div className="mt-3">
              <Link href="/apply">
                <Button size="sm">Apply to join the network</Button>
              </Link>
            </div>
          </>
        )}
      </Empty>
    </div>
  );
}
