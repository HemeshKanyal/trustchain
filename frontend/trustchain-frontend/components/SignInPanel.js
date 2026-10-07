"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { AlertTriangle, FlaskConical, KeyRound, Lock, Wallet } from "lucide-react";
import { useMe } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { ROLE_META, roleKeyOf } from "@/lib/roles";
import { IS_LOCAL } from "@/lib/config";
import { DEV_ACCOUNTS } from "@/lib/wagmi";
import { ROLES, date, short } from "@/lib/format";
import { Button, Modal, Notice } from "./ui";

/** Sign in as `org` (a registered participant). Only its own wallet gets in. */
export default function SignInPanel({ org, roleKey, onClose }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const me = useMe();
  const { valid, signIn } = useSession();
  const { openConnectModal } = useConnectModal();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sealed, setSealed] = useState(false);
  const meta = ROLE_META[roleKey];
  const matches = Boolean(address && org && address.toLowerCase() === org.address.toLowerCase());
  const demo = IS_LOCAL && org && DEV_ACCOUNTS.find((a) => a.address.toLowerCase() === org.address.toLowerCase());

  const ready = Boolean(matches && org?.active && valid);
  // Show the "sealed" moment, then open the workspace. Separate from `sealed` so re-renders can't cancel it.
  useEffect(() => {
    if (!ready) return;
    const show = setTimeout(() => setSealed(true), 0);
    const go = setTimeout(() => router.push(meta.home), 700);
    return () => {
      clearTimeout(show);
      clearTimeout(go);
    };
  }, [ready, router, meta.home]);

  async function switchToDemo() {
    const c = connectors.find((x) => x.id === `dev-${demo.address}`);
    if (isConnected) await disconnectAsync();
    await connectAsync({ connector: c });
  }

  async function doSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError(e?.shortMessage ?? e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!org) return null;
  const otherKey = me.role ? roleKeyOf(me.role) : null;

  return (
    <Modal open onClose={onClose} title={`Sign in as ${org.name}`}>
      <div className="space-y-4" data-testid="signin-panel">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
          <div className="font-medium text-white">{org.name}</div>
          <div className="mt-1 text-slate-400">
            {ROLES[org.role]} · {org.location || "—"} · licence {org.licenseId || "—"}
          </div>
          <div className="mt-1 break-all font-mono text-xs text-slate-500">Registered wallet {org.address}</div>
        </div>

        {sealed ? (
          <div className="flex items-center gap-4 py-2" data-testid="signin-sealed">
            <svg className="hex-seal" width="52" height="46" viewBox="0 0 26 23" fill="none">
              <path d="M6.5 1h13L26 11.5 19.5 22h-13L0 11.5z" stroke="#2dd4bf" strokeWidth="1.5" />
              <path className="tick" d="M8 11.8l3.4 3.3L18 8.3" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-sm text-teal-200">Wallet verified. Opening your workspace…</div>
          </div>
        ) : !isConnected ? (
          <>
            <Notice tone="info" icon={Wallet}>
              Connect the wallet registered to {org.name} ({short(org.address)}).
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openConnectModal}>Connect wallet</Button>
              {demo && (
                <Button variant="secondary" onClick={switchToDemo} data-testid="use-demo">
                  <FlaskConical className="h-4 w-4" /> Use demo account
                </Button>
              )}
            </div>
          </>
        ) : !matches ? (
          <>
            <Notice tone="warn" icon={AlertTriangle} title="Wrong wallet">
              This wallet ({short(address)}) is not {org.name}&apos;s. Switch to {short(org.address)} in your wallet.
              {otherKey && (
                <>
                  {" "}
                  It belongs to <b>{me.participant?.name}</b> ({ROLES[me.role]}).{" "}
                  <Link className="text-white underline" href={`/portal/${otherKey}?org=${address}`} onClick={onClose}>
                    Sign in as them instead
                  </Link>
                </>
              )}
            </Notice>
            {demo && (
              <Button variant="secondary" onClick={switchToDemo} data-testid="use-demo">
                <FlaskConical className="h-4 w-4" /> Switch to the demo account
              </Button>
            )}
          </>
        ) : !org.active ? (
          <Notice tone="danger" icon={Lock} title="Account suspended">
            The regulator suspended {org.name}. Contact the network admin to be reinstated.
          </Notice>
        ) : (
          <>
            <Notice tone="ok" icon={KeyRound} title="Wallet matches">
              Sign one message to prove it&apos;s you. It&apos;s free and sends no transaction; the session lasts 12 hours.
            </Notice>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <Button className="w-full" onClick={doSignIn} loading={busy} data-testid="signin-submit">
              Sign in to {meta.title.toLowerCase()} workspace
            </Button>
          </>
        )}
        <p className="text-xs text-slate-500">
          Picking a card only helps you find yourself. Every action is still signed by your wallet and checked by the blockchain. Member since {date(org.registeredAt)}.
        </p>
      </div>
    </Modal>
  );
}
