"use client";
import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { LogOut, Repeat } from "lucide-react";
import { useApi, useMe } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { ROLE_META } from "@/lib/roles";
import { ROLES } from "@/lib/format";
import { Badge, Spinner, cx } from "./ui";

const Ctx = createContext(null);
/** Inside a workspace: { me, session } for the signed-in organisation. */
export const useWorkspace = () => useContext(Ctx);

export default function Workspace({ roleKey, nav, children }) {
  const meta = ROLE_META[roleKey];
  const router = useRouter();
  const path = usePathname();
  const { status } = useAccount();
  const me = useMe();
  const session = useSession();
  const health = useApi("/api/health", { refetchInterval: 15000 });

  const settling = status === "reconnecting" || status === "connecting" || (me.isConnected && me.loading);
  const roleOk = meta.role === 0 ? me.isConnected : meta.role === 1 ? me.isAdmin : me.role === meta.role && me.active;
  const allowed = me.isConnected && roleOk && session.valid;

  useEffect(() => {
    if (settling || allowed) return;
    const t = setTimeout(() => router.replace(roleKey === "patient" ? "/portal/patient" : `/portal/${roleKey}${me.address ? `?org=${me.address}` : ""}`), 250);
    return () => clearTimeout(t);
  }, [settling, allowed, router, roleKey, me.address]);

  if (!allowed) return <Spinner label={settling ? "Checking your wallet…" : "Taking you to sign in…"} />;

  const Icon = meta.icon;
  const name = meta.role === 0 ? "My medicines" : me.participant?.name;
  const active = (item) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`));

  return (
    <Ctx.Provider value={{ me, session }}>
      <div className="lg:grid lg:grid-cols-[232px_1fr] lg:gap-8">
        <aside className="no-print hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white" data-testid="workspace-org">{name}</div>
                  <div className="text-xs text-slate-400">{meta.role === 0 ? "Patient" : meta.role === 1 ? (me.isOwner ? "Network owner" : "Regulator") : ROLES[me.role]}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <span className={cx("h-2 w-2 rounded-full", health.data ? "animate-pulse bg-ok" : "bg-danger")} />
                {health.data ? `Live · block ${health.data.indexedBlock}` : "Live data paused"}
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    active(n) ? "bg-white/[0.08] text-white ring-1 ring-white/10" : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="flex-1">{n.label}</span>
                  {n.count > 0 && <Badge tone="brand">{n.count}</Badge>}
                </Link>
              ))}
            </nav>
            <div className="space-y-1 border-t border-white/[0.06] pt-4">
              <Link href="/portal" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white">
                <Repeat className="h-4 w-4" /> Switch portal
              </Link>
              <button type="button" onClick={() => { session.signOut(); router.push("/portal"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white" data-testid="sign-out">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>
        <div className="min-w-0 pb-24 lg:pb-0">{children}</div>
      </div>

      {/* phone: bottom tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-ink-950/90 backdrop-blur-xl lg:hidden">
        {nav.slice(0, 5).map((n) => (
          <Link key={n.href} href={n.href} className={cx("flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]", active(n) ? "text-brand" : "text-slate-400")}>
            <n.icon className="h-5 w-5" />
            {n.short ?? n.label}
          </Link>
        ))}
      </nav>
    </Ctx.Provider>
  );
}
