"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, FlaskConical, Menu, PauseCircle, X } from "lucide-react";
import { WalletButton } from "./Wallet";
import PortalsMenu from "./PortalsMenu";
import Nebula from "./fx/Nebula";
import { useApi, useMe, usePaused } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { ROLE_META, ROLE_ORDER, roleKeyOf } from "@/lib/roles";
import { useRoleCounts } from "./PortalsMenu";
import { DEPLOYED, CHAIN_ID, chain, STORY_URL } from "@/lib/config";
import { cx } from "./ui";

const LINKS = [
  { href: "/verify", label: "Verify" },
  { href: "/network", label: "Network" },
  { href: "/live", label: "Live map" },
];

function SignedInChip() {
  const me = useMe();
  const { valid } = useSession();
  if (!me.isConnected || !valid) return null;
  const key = me.isAdmin ? "admin" : roleKeyOf(me.role) ?? "patient";
  const meta = ROLE_META[key];
  return (
    <Link href={meta.home} className="hidden items-center gap-2 rounded-lg border border-brand/30 bg-brand/[0.08] px-3 py-1.5 text-xs text-teal-100 hover:bg-brand/15 md:flex" data-testid="signed-in-chip">
      <meta.icon className="h-3.5 w-3.5" />
      <span className="max-w-40 truncate">{key === "patient" ? "My medicines" : me.participant?.name}</span>
    </Link>
  );
}

/** Story-site header: transparent, hides while scrolling down, comes back when scrolling up. */
function useHeaderState() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      setHidden(y > 120 && y > last.current);
      last.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { hidden, scrolled };
}

function MobileMenu({ onClose }) {
  const counts = useRoleCounts();
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-ink-950/95 px-5 pb-10 pt-24 backdrop-blur-xl md:hidden" data-testid="mobile-menu">
      <div className="mb-6 sm:hidden">
        <WalletButton />
      </div>
      <nav className="space-y-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={onClose} className="block py-2 text-4xl font-extrabold tracking-tight text-white">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-10 text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-300">Portals</div>
      <div className="mt-4 grid gap-2">
        {ROLE_ORDER.map((k) => {
          const m = ROLE_META[k];
          return (
            <Link key={k} href={`/portal/${k}`} onClick={onClose} className="card flex items-center gap-3 p-4" data-testid={`mobile-portal-${k}`}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25"><m.icon className="h-5 w-5" /></span>
              <span className="flex-1">
                <span className="block font-semibold text-white">{m.title}</span>
                <span className="block text-xs text-slate-400">{m.role > 0 ? `${counts[m.role] ?? 0} registered` : "Any wallet"}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const path = usePathname();
  const paused = usePaused();
  const sim = useApi("/api/sim/status", { refetchInterval: 30000, retry: 0 });
  const { hidden, scrolled } = useHeaderState();
  const [menuAt, setMenuAt] = useState(null);
  const menuOpen = menuAt === path; // navigating closes the menu
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);
  const link = (l) => (
    <Link key={l.href} href={l.href} className={cx("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition", path.startsWith(l.href) ? "text-white" : "text-slate-300 hover:text-white")}>
      {l.label}
      <span className={cx("mx-auto mt-0.5 block h-px bg-brand transition-all", path.startsWith(l.href) ? "w-4" : "w-0")} />
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Nebula />
      <header
        className={cx(
          "no-print fixed inset-x-0 top-0 z-[100] transition duration-500",
          hidden && !menuOpen ? "-translate-y-full" : "translate-y-0",
          scrolled && !menuOpen ? "bg-ink-950/40 backdrop-blur-md" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-5 sm:px-6">
          <Link href="/" className="shrink-0 leading-none" onClick={() => setMenuAt(null)}>
            <span className="block text-2xl font-black tracking-[0.04em] text-white sm:text-[1.7rem]">TRUSTCHAIN</span>
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.4em] text-slate-400">TRUST. SECURED</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {LINKS.map(link)}
            <PortalsMenu />
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SignedInChip />
            <div className="hidden sm:block"><WalletButton /></div>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/30 text-white md:hidden"
              onClick={() => setMenuAt(menuOpen ? null : path)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              data-testid="menu-button"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>
      {menuOpen && <MobileMenu onClose={() => setMenuAt(null)} />}
      <div className="h-20" />

      {!DEPLOYED && (
        <div className="no-print border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-sm text-amber-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          Contracts are not deployed on {chain.name} (chain {CHAIN_ID}). Deploy, then run <code>npm run sync</code>.
        </div>
      )}
      {paused.data && (
        <div className="no-print border-b border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm text-rose-200">
          <PauseCircle className="mr-1.5 inline h-4 w-4" />
          The network is paused by the regulator. Verification works; transfers and dispensing are on hold.
        </div>
      )}

      {sim.data?.running && (
        <div className="no-print border-b border-violet-400/20 bg-violet-500/10 px-4 py-2 text-center text-sm text-violet-200" data-testid="sim-banner">
          <FlaskConical className="mr-1.5 inline h-4 w-4" />
          Showcase network: organisations and trucks marked <b>Simulated</b> are fictional; every transaction and signed reading is real.
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="no-print border-t border-white/[0.06] py-8 text-center text-xs text-slate-500">
        <span className="font-semibold tracking-[0.2em] text-slate-400">TRUSTCHAIN</span> · medicines tracked from factory to patient ·{" "}
        <a href={STORY_URL} className="hover:text-slate-300" target="_blank" rel="noreferrer">
          Our story
        </a>{" "}
        · {chain.name}
      </footer>
    </div>
  );
}
