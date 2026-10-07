"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useParticipants } from "@/lib/hooks";
import { ROLE_META, ROLE_ORDER } from "@/lib/roles";
import { cx } from "./ui";

export function useRoleCounts() {
  const { data } = useParticipants();
  const counts = {};
  for (const p of data ?? []) if (p.active) counts[p.role] = (counts[p.role] ?? 0) + 1;
  return counts;
}

/** Top-bar "Portals" menu: every role, with how many organisations are registered in it. */
export default function PortalsMenu() {
  const ref = useRef(null);
  const path = usePathname();
  const counts = useRoleCounts();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === path;
  const setOpen = (v) => setOpenAt(typeof v === "function" ? (v(open) ? path : null) : v ? path : null);
  useEffect(() => {
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpenAt(null);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx("flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition", open || path.startsWith("/portal") ? "bg-white/[0.08] text-white" : "text-slate-300 hover:text-white")}
        data-testid="portals-menu"
        aria-expanded={open}
      >
        Portals <ChevronDown className={cx("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-11 z-50 w-[min(92vw,640px)] -translate-x-1/2 sm:left-0 sm:translate-x-0">
          <div className="card grid gap-2 bg-ink-900/95 p-3 sm:grid-cols-2">
            {ROLE_ORDER.map((k) => {
              const m = ROLE_META[k];
              return (
                <Link key={k} href={`/portal/${k}`} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-white/[0.06]" data-testid={`portal-${k}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
                    <m.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium text-white">{m.title}</span>
                      {m.role > 0 && <span className="text-xs text-slate-500">{counts[m.role] ?? 0} registered</span>}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{m.blurb}</span>
                  </span>
                </Link>
              );
            })}
            <Link href="/portal" className="rounded-xl px-3 py-2 text-center text-xs text-slate-400 hover:text-white sm:col-span-2">
              All portals · Apply to join
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
