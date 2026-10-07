"use client";
import { useState } from "react";
import { Radio } from "lucide-react";
import { useApi, useParticipants } from "@/lib/hooks";
import { locate } from "@/lib/geo";
import { ROLES, dateTime } from "@/lib/format";
import RoadMap from "@/components/work/RoadMap";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Badge, Card, cx } from "@/components/ui";

export default function LiveMap() {
  const ships = useApi("/api/shipments?status=InTransit", { refetchInterval: 10000 });
  const alerts = useApi("/api/alerts?limit=30", { refetchInterval: 10000 });
  const stats = useApi("/api/stats", { refetchInterval: 10000 });
  const people = useParticipants();
  const [focus, setFocus] = useState(null);
  const orgs = (people.data ?? [])
    .filter((p) => p.active && p.role > 1)
    .map((p) => ({ id: p.address, at: locate(p.location), label: `${p.name} · ${ROLES[p.role]}`, tone: "slate", radius: 5 }))
    .filter((p) => p.at);
  const list = (ships.data ?? []).map((s) => ({ ...s, from: s.from_addr, to: s.to_addr }));

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow n={4}>Live cold chain</Eyebrow>
          <h1 className="display mt-5 text-4xl sm:text-6xl">On the road, <span className="text-brand">right now.</span></h1>
        </div>
        <div className="flex gap-6 text-sm text-slate-400">
          <span><b className="text-2xl text-white">{stats.data?.inTransit ?? "—"}</b> in transit</span>
          <span><b className="text-2xl text-white">{stats.data?.devices ?? "—"}</b> smart boxes</span>
          <span><b className="text-2xl text-white">{stats.data?.telemetryReports ?? "—"}</b> signed reports</span>
        </div>
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RoadMap shipments={list} extraPlaces={orgs} height={560} focusId={focus} />
        <Card title="Alerts" subtitle="Click one to find it on the map." bodyClassName="max-h-[480px] overflow-y-auto p-3">
          <ul className="space-y-2">
            {(alerts.data ?? []).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setFocus(a.shipmentId ? `s${a.shipmentId}` : null)}
                  className={cx("w-full rounded-xl border p-3 text-left text-sm transition hover:bg-white/[0.04]", a.type === "recall" || a.type === "breach" ? "border-danger/30" : "border-white/[0.08]", focus === `s${a.shipmentId}` && "bg-white/[0.06]")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{a.type === "breach" ? "Cold-chain breach" : a.type === "recall" ? "Recall" : a.type === "quarantine" ? "Batch on hold" : "Hold released"}</span>
                    <Badge tone={a.type === "quarantine_released" ? "ok" : "danger"}>batch #{a.batchId}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{a.details?.reasons?.join(", ") || a.details?.reason || a.details?.note}</div>
                  <div className="mt-1 text-xs text-slate-500">{dateTime(a.createdAt)}{a.shipmentId ? ` · shipment #${a.shipmentId}` : ""}</div>
                </button>
              </li>
            ))}
            {!alerts.data?.length && (
              <li className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500"><Radio className="h-6 w-6" /> All quiet.</li>
            )}
          </ul>
        </Card>
      </div>
      <p className="text-xs text-slate-500">Routes are drawn between the sender&apos;s and receiver&apos;s cities; a bright dot is a smart box&apos;s last GPS fix.</p>
    </div>
  );
}
