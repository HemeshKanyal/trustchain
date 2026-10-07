"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Boxes } from "lucide-react";
import { useApi, useBatch, useNames } from "@/lib/hooks";
import { useNebula } from "@/components/fx/Nebula";
import { date, pct, temp, ZERO } from "@/lib/format";
import Timeline from "@/components/Timeline";
import RoadMap from "@/components/work/RoadMap";
import { BatchStatus } from "@/components/status";
import { BoxStatus } from "@/components/ShipmentTable";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Address, Badge, Card, Empty, Spinner } from "@/components/ui";
import RiskPanel from "@/components/ai/RiskPanel";

export default function BatchPage() {
  const { id } = useParams();
  const { data: batch, isLoading } = useBatch(id);
  const timeline = useApi(`/api/batches/${id}/timeline`, { refetchInterval: 10000 });
  const name = useNames();
  useNebula(batch?.status === 2 ? "rose" : batch?.status === 1 ? "amber" : "teal");

  if (isLoading) return <Spinner />;
  if (!batch || batch.manufacturer === ZERO) return <Empty icon={Boxes} title={`Batch #${id} not found`} />;
  const shipments = (timeline.data ?? []).filter((e) => e.name === "ShipmentCreated").map((e) => e.args);
  const c = batch.conditions;

  return (
    <div className="space-y-8">
      <Reveal>
        <Eyebrow n={2} tone={batch.status === 2 ? "danger" : batch.status === 1 ? "warn" : "brand"}>Batch journey</Eyebrow>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-4xl sm:text-6xl">{batch.productName}</h1>
            <p className="mt-3 text-slate-400">Lot {batch.lotNumber} · batch #{batch.id} · by {name(batch.manufacturer) ?? "manufacturer"}</p>
          </div>
          <BatchStatus batch={batch} />
        </div>
      </Reveal>

      <Reveal delay={0.03}>
        <RiskPanel batchId={batch.id} />
      </Reveal>

      {shipments.length > 0 && (
        <Reveal delay={0.05}>
          <RoadMap shipments={shipments.map((s) => ({ id: Number(s.shipmentId), from: s.from, to: s.to }))} height={260} />
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card title="Batch details">
            <dl className="space-y-3 text-sm">
              <Item label="Manufacturer"><Address address={batch.manufacturer} name={name(batch.manufacturer)} /></Item>
              <Item label="Manufactured">{date(batch.manufacturedAt)}</Item>
              <Item label="Expires">{date(batch.expiresAt)}</Item>
              <Item label="Strips">{batch.quantity} ({batch.stripsRegistered} serialised)</Item>
              <Item label="Storage">{temp(c.minTempX10)} – {temp(c.maxTempX10)}{Number(c.maxHumidityX10) ? `, ≤ ${pct(c.maxHumidityX10)} RH` : ""}</Item>
              <Item label="Sale">{batch.rxOnly ? <Badge tone="info">Prescription only</Badge> : <Badge>Over the counter</Badge>}</Item>
            </dl>
          </Card>
          {shipments.length > 0 && (
            <Card title="Shipments">
              <ul className="space-y-2">
                {shipments.map((s) => (
                  <li key={s.shipmentId} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/shipment/${s.shipmentId}`} className="text-slate-200 hover:text-brand">#{s.shipmentId} → {name(s.to) ?? "recipient"}</Link>
                    {s.device !== ZERO ? <BoxStatus shipmentId={s.shipmentId} /> : <Badge>no box</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card title="Journey" subtitle="Every step is sealed on the blockchain and cannot be edited." className="lg:col-span-2">
          {timeline.isLoading ? <Spinner /> : timeline.error ? <p className="text-sm text-slate-400">History service unavailable.</p> : <Timeline events={timeline.data} />}
        </Card>
      </div>
    </div>
  );
}

function Item({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-100">{children}</dd>
    </div>
  );
}
