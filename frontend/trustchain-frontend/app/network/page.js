"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useApi, useParticipants } from "@/lib/hooks";
import { ROLES } from "@/lib/format";
import OrgCard from "@/components/OrgCard";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Input, Spinner, cx } from "@/components/ui";

export default function Network() {
  const router = useRouter();
  const { data, isLoading } = useParticipants();
  const stats = useApi("/api/orgs/stats", { refetchInterval: 30000 });
  const [q, setQ] = useState("");
  const [role, setRole] = useState(0);
  const all = (data ?? []).filter((p) => p.role > 1);
  const list = all.filter((p) => (!role || p.role === role) && (!q || `${p.name} ${p.location} ${p.licenseId}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <Reveal>
        <Eyebrow n={3}>Network</Eyebrow>
        <h1 className="display mt-5 text-4xl sm:text-6xl">Who&apos;s on <span className="text-brand">TrustChain</span>.</h1>
        <p className="mt-4 max-w-xl text-slate-400">Every organisation here was checked by the regulator. Their track record is public and comes straight from the blockchain.</p>
      </Reveal>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations" className="pl-10" aria-label="Search organisations" />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {[0, 2, 3, 4, 5].map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={cx("shrink-0 rounded-lg px-3 py-1.5 text-sm", role === r ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
              {r ? `${ROLES[r]}s` : "All"} <span className="text-xs text-slate-500">{r ? all.filter((p) => p.role === r).length : all.length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        {isLoading ? <Spinner /> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => <OrgCard key={p.address} org={p} stats={stats.data?.[p.address]} onClick={() => router.push(`/network/${p.address}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
