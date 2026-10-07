"use client";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { ROLE_META, ROLE_ORDER } from "@/lib/roles";
import { useRoleCounts } from "@/components/PortalsMenu";
import { Eyebrow, Reveal } from "@/components/fx/motion";

export default function PortalHome() {
  const counts = useRoleCounts();
  return (
    <div>
      <Reveal>
        <Eyebrow n={1}>Portals</Eyebrow>
        <h1 className="display mt-5 text-5xl sm:text-7xl">
          Who are <span className="text-brand">you?</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-400">Pick your role, find your organisation, and sign in with its wallet. Patients and anyone verifying a strip need no account.</p>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_ORDER.map((k, i) => {
          const m = ROLE_META[k];
          return (
            <Reveal key={k} delay={i * 0.05}>
              <Link href={`/portal/${k}`} className="card card-hover group flex h-full flex-col p-6" data-testid={`role-card-${k}`}>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/25">
                    <m.icon className="h-6 w-6" />
                  </span>
                  <span className="text-xs text-slate-500">{m.role > 0 ? `${counts[m.role] ?? 0} registered` : "Any wallet"}</span>
                </div>
                <div className="mt-6 text-2xl font-semibold text-white">{m.title}</div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{m.blurb}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-brand">
                  {m.role > 0 ? `Find your ${m.title.toLowerCase()}` : "Open my medicines"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={0.2}>
        <Link href="/portal/apply" className="card card-hover mt-4 flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-slate-200 ring-1 ring-white/10">
            <UserPlus className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <div className="font-semibold text-white">Not registered yet?</div>
            <div className="text-sm text-slate-400">Manufacturers, distributors, pharmacies and doctors apply here; the regulator approves.</div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400" />
        </Link>
      </Reveal>
    </div>
  );
}
