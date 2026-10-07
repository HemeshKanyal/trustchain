"use client";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, PauseCircle } from "lucide-react";
import { useAllBatches, useApplications, useApi, useDevices, useParticipants } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { locate } from "@/lib/geo";
import { ROLES, date } from "@/lib/format";
import Globe from "@/components/fx/Globe";
import { CountUp } from "@/components/fx/motion";
import AlertsFeed from "@/components/AlertsFeed";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export default function AdminOverview() {
  const { me } = useWorkspace();
  const apps = useApplications();
  const people = useParticipants();
  const batches = useAllBatches();
  const devices = useDevices();
  const stats = useApi("/api/stats", { refetchInterval: 15000 });
  const held = (batches.data ?? []).filter((b) => b.status === 1);
  const markers = (people.data ?? []).map((p) => locate(p.location)).filter(Boolean).map((location) => ({ location, size: 0.06 }));
  const byRole = [2, 3, 4, 5].map((r) => [ROLES[r], (people.data ?? []).filter((p) => p.role === r && p.active).length]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Command centre" n={1} title="Good to see you." subtitle={`${me.isOwner ? "Network owner" : "Regulator"} · ${apps.data?.length ?? 0} applications and ${held.length} held batches need a decision.`} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Needs your decision" className="lg:col-span-3">
          {!apps.data?.length && !held.length ? (
            <Empty title="Inbox zero">Nothing is waiting for you.</Empty>
          ) : (
            <ul className="space-y-2">
              {(apps.data ?? []).map((a) => (
                <li key={a.address}>
                  <Link href="/admin/applications" className="flex items-center gap-3 rounded-xl border border-white/[0.07] p-3 hover:bg-white/[0.04]">
                    <ClipboardCheck className="h-5 w-5 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{a.name} wants to join as {ROLES[a.role]}</div>
                      <div className="text-xs text-slate-400">{a.location || "—"} · applied {date(a.appliedAt)}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </Link>
                </li>
              ))}
              {held.map((b) => (
                <li key={b.id}>
                  <Link href="/admin/batches" className="flex items-center gap-3 rounded-xl border border-warn/25 bg-warn/[0.04] p-3 hover:bg-warn/[0.08]">
                    <PauseCircle className="h-5 w-5 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">Batch #{b.id} {b.productName} is on hold</div>
                      <div className="text-xs text-slate-400">Release after review, or recall</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="The network" className="lg:col-span-2" bodyClassName="flex flex-col items-center">
          <Globe markers={markers} size={260} />
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-sm">
            {byRole.map(([label, n]) => (
              <div key={label} className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="text-slate-400">{label}s</span>
                <span className="font-semibold text-white">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          ["Batches on-chain", stats.data?.batches],
          ["Shipments in transit", stats.data?.inTransit],
          ["Smart boxes", devices.data?.length],
          ["Recalls", stats.data?.recalls],
        ].map(([l, v]) => (
          <div key={l} className="card px-5 py-4">
            <div className="text-xs text-slate-400">{l}</div>
            <div className="mt-1 text-3xl font-semibold text-white"><CountUp value={v} /></div>
          </div>
        ))}
      </div>

      <Card title="Latest alerts" actions={<Link href="/admin/alerts"><Badge tone="brand">All alerts</Badge></Link>}>
        <AlertsFeed limit={5} authAddress={me.address} showPatients />
      </Card>
    </div>
  );
}
