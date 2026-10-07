"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Truck } from "lucide-react";
import { useApi, useBatch, useNames, useShipment, useTelemetrySummary } from "@/lib/hooks";
import { explorerTx } from "@/lib/config";
import { dateTime, pct, temp, ZERO } from "@/lib/format";
import TelemetryChart from "@/components/TelemetryChart";
import { BreachBadges, ShipmentStatus } from "@/components/status";
import { Address, Badge, Card, Empty, PageHeader, Spinner, Stat } from "@/components/ui";
import SmartBox from "@/components/fx/SmartBox";
import ColdChainCard from "@/components/ai/ColdChainCard";
import { useNebula } from "@/components/fx/Nebula";

export default function ShipmentPage() {
  const { id } = useParams();
  const { data: s, isLoading } = useShipment(id);
  const { data: batch } = useBatch(s?.batchId || null);
  const { data: summary } = useTelemetrySummary(id);
  const tele = useApi(`/api/shipments/${id}/telemetry`, { refetchInterval: 10000 });
  const name = useNames();

  useNebula(summary && Number(summary.breachCount) ? "rose" : "teal");
  if (isLoading) return <Spinner />;
  if (!s || s.status === 0) return <Empty icon={Truck} title={`Shipment #${id} not found`} />;
  const reports = tele.data?.reports ?? [];
  const samples = tele.data?.samples ?? [];
  const lastFix = [...samples].reverse().find((x) => x.flags & 2);
  const latest = reports.at(-1);
  const boxState = !s || s.device === ZERO ? "idle" : !latest ? "sealed" : latest.tamper ? "opened" : latest.breach_flags ? "hot" : "sealed";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title={`Shipment #${s.id}`}
        subtitle={
          <>
            {batch?.productName} ·{" "}
            <Link className="text-brand hover:underline" href={`/batch/${s.batchId}`}>
              batch #{s.batchId}
            </Link>{" "}
            · {s.quantity} strips
          </>
        }
        actions={<ShipmentStatus status={s.status} />}
      />

      <div className="grid items-center gap-6 lg:grid-cols-[320px_1fr]">
        <SmartBox state={boxState} size={260} label={latest ? `Last report ${dateTime(latest.window_end)}` : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="From" value={<span className="text-base">{name(s.from) ?? "—"}</span>} sub={<Address address={s.from} />} />
        <Stat label="To" value={<span className="text-base">{name(s.to) ?? "—"}</span>} sub={<Address address={s.to} />} />
        <Stat label="Signed box reports" value={summary ? Number(summary.reportCount) : "—"} sub={s.device === ZERO ? "No smart box" : `Box ${s.device.slice(0, 8)}…`} />
        <Stat
          label="Breaches"
          value={summary ? Number(summary.breachCount) : "—"}
          tone={summary && Number(summary.breachCount) ? "danger" : "ok"}
          sub={summary && Number(summary.reportCount) ? `Seen ${temp(summary.minTempSeenX10)} – ${temp(summary.maxTempSeenX10)}` : undefined}
        />
      </div>
      </div>

      {s.device === ZERO ? (
        <Card>
          <Empty icon={Truck} title="This shipment had no smart box">Custody was still recorded on-chain at dispatch and receipt.</Empty>
        </Card>
      ) : (
        <>
          <Card
            title="Cold chain"
            subtitle={`Created ${dateTime(s.createdAt)}${s.deliveredAt ? ` · delivered ${dateTime(s.deliveredAt)}` : ""}`}
            actions={
              lastFix && (
                <a className="flex items-center gap-1 text-xs text-brand hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${lastFix.lat_e6 / 1e6}&mlon=${lastFix.lon_e6 / 1e6}#map=12/${lastFix.lat_e6 / 1e6}/${lastFix.lon_e6 / 1e6}`}>
                  <MapPin className="h-3.5 w-3.5" /> Last position
                </a>
              )
            }
          >
            {tele.isLoading ? <Spinner /> : samples.length ? <TelemetryChart samples={samples} conditions={batch?.conditions} /> : <Empty title="Waiting for the smart box">Reports arrive every window (usually 30 s – 5 min).</Empty>}
          </Card>
          <ColdChainCard shipmentId={s.id} />
          <Card title="Signed reports" subtitle="Each report is signed by the box's own key and verified on-chain.">
            {!reports.length ? (
              <Empty title="No reports yet" />
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="pl-5">#</th>
                      <th>Window</th>
                      <th>Temp</th>
                      <th>Humidity</th>
                      <th>Lid</th>
                      <th>Result</th>
                      <th className="pr-5">On-chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...reports].reverse().map((r) => (
                      <tr key={r.seq}>
                        <td className="pl-5 tabular-nums text-slate-400">{r.seq}</td>
                        <td className="text-xs">{dateTime(r.window_start)} · {r.readings} samples</td>
                        <td className="tabular-nums">{temp(r.min_temp_x10)} – {temp(r.max_temp_x10)}</td>
                        <td className="tabular-nums">≤ {pct(r.max_humidity_x10)}</td>
                        <td>{r.tamper ? <Badge tone="danger">Opened</Badge> : <Badge tone="ok">Sealed</Badge>}</td>
                        <td>{r.status === "confirmed" ? <BreachBadges flags={r.breach_flags} /> : <Badge tone={r.status === "pending" ? "info" : "danger"}>{r.status}</Badge>}</td>
                        <td className="pr-5 font-mono text-xs text-slate-500">
                          {r.tx_hash ? (explorerTx(r.tx_hash) ? <a className="hover:text-brand" href={explorerTx(r.tx_hash)} target="_blank" rel="noreferrer">{r.tx_hash.slice(0, 10)}…</a> : `${r.tx_hash.slice(0, 10)}…`) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
