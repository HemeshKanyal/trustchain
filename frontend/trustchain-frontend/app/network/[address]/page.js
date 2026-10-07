"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import { useApi, useNames, useParticipant } from "@/lib/hooks";
import { describe, toneOf } from "@/lib/activity";
import { locate } from "@/lib/geo";
import { ROLES, date, dateTime, isSimulated } from "@/lib/format";
import { roleKeyOf } from "@/lib/roles";
import { CountUp, Eyebrow, Reveal } from "@/components/fx/motion";
import { Address, Badge, Button, Card, Empty, SimBadge, Spinner, cx } from "@/components/ui";

const RouteMap = dynamic(() => import("@/components/fx/RouteMap"), { ssr: false });

export default function OrgProfile() {
  const { address } = useParams();
  const { data: p, isLoading } = useParticipant(address);
  const stats = useApi(`/api/orgs/${address}/stats`, { refetchInterval: 20000 });
  const activity = useApi(`/api/orgs/${address}/activity`, { refetchInterval: 20000 });
  const compliance = useApi(`/api/ai/orgs/${address}/compliance`, { refetchInterval: 30000 });
  const name = useNames();
  if (isLoading) return <Spinner />;
  if (!p || Number(p.role) === 0) return <div className="card"><Empty icon={Building2} title="Not a registered organisation" /></div>;
  const role = Number(p.role);
  const s = stats.data;
  const at = locate(p.location);
  const tiles =
    role === 2 ? [["Batches made", s?.batchesMade], ["Strips made", s?.stripsMade], ["Shipments sent", s?.shipmentsSent], ["Recalls issued", s?.recallsIssued]]
    : role === 3 ? [["Shipments received", s?.shipmentsReceived], ["Shipments sent", s?.shipmentsSent], ["Monitored trips", s?.monitoredShipments], ["Breach-free", s?.breachFreeRate == null ? null : Math.round(s.breachFreeRate * 100)]]
    : role === 4 ? [["Deliveries received", s?.shipmentsReceived], ["Strips dispensed", s?.stripsDispensed], ["Returns sent", s?.shipmentsSent]]
    : role === 5 ? [["Prescriptions issued", s?.prescriptionsIssued]]
    : [];
  const key = roleKeyOf(role);
  return (
    <div className="space-y-8">
      <Reveal>
        <Eyebrow n={3}>{ROLES[role]}</Eyebrow>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-4xl sm:text-6xl">{p.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {p.location || "—"}</span>
              <span>Licence {p.licenseId || "—"}</span>
              <span>Member since {date(p.registeredAt)}</span>
            </p>
            <div className="mt-2"><Address address={address} /></div>
          </div>
          <div className="flex items-center gap-2">
            {isSimulated(p) && <SimBadge />}
            {p.active ? <Badge tone="ok">Verified by regulator</Badge> : <Badge tone="danger">Suspended</Badge>}
            {compliance.data && role > 1 && <Badge tone={compliance.data.score >= 90 ? "ok" : compliance.data.score >= 55 ? "warn" : "danger"}>AI compliance {compliance.data.grade} · {compliance.data.score}</Badge>}
            {key && <Link href={`/portal/${key}?org=${address}`}><Button size="sm" variant="secondary">This is us: sign in</Button></Link>}
          </div>
        </div>
      </Reveal>
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {tiles.map(([l, v]) => (
            <div key={l} className="card px-5 py-4">
              <div className="text-xs text-slate-400">{l}</div>
              <div className="mt-1 text-3xl font-semibold text-white">{v == null ? "—" : <CountUp value={v} format={(n) => (l === "Breach-free" ? `${n}%` : n.toLocaleString())} />}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Recent on-chain activity" className="lg:col-span-3">
          {!activity.data ? <Spinner /> : !activity.data.length ? <Empty title="No activity yet" /> : (
            <ul className="space-y-2">
              {activity.data.map((e, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneOf(e) === "rose" ? "bg-danger" : "bg-brand")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200">{describe(e, name)}</div>
                    <div className="text-xs text-slate-500">
                      {dateTime(e.timestamp)}
                      {e.batchId && <> · <Link className="hover:text-brand" href={`/batch/${e.batchId}`}>batch #{e.batchId}</Link></>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Location" className="lg:col-span-2">
          {at ? <RouteMap places={[{ id: address, at, label: p.name, tone: "teal" }]} height={280} /> : <p className="text-sm text-slate-400">No map position for “{p.location}”.</p>}
        </Card>
      </div>
    </div>
  );
}
