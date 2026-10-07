"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useApi, useBatch, useBatchAffected, useNames } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import Timeline from "@/components/Timeline";
import Distribution from "@/components/work/Distribution";
import RecallModal from "@/components/work/RecallModal";
import { BatchStatus } from "@/components/status";
import { ROLES, date, pct, temp } from "@/lib/format";
import { Address, Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function BatchDetail() {
  const { id } = useParams();
  const { me } = useWorkspace();
  const { data: b, isLoading } = useBatch(id);
  const affected = useBatchAffected(id);
  const timeline = useApi(`/api/batches/${id}/timeline`, { refetchInterval: 10000 });
  const name = useNames();
  const [recalling, setRecalling] = useState(false);
  if (isLoading) return <Spinner />;
  if (!b || b.manufacturer.toLowerCase() !== me.address.toLowerCase()) return <div className="card"><Empty title="Not one of your batches" /></div>;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Batch #${b.id}`}
        title={b.productName}
        subtitle={`Lot ${b.lotNumber} · made ${date(b.manufacturedAt)} · expires ${date(b.expiresAt)} · ${temp(b.conditions.minTempX10)}–${temp(b.conditions.maxTempX10)}${Number(b.conditions.maxHumidityX10) ? `, ≤${pct(b.conditions.maxHumidityX10)}` : ""}`}
        actions={
          <>
            <BatchStatus batch={b} />
            <Link href={`/manufacturer/batches/${b.id}/labels`}><Button variant="secondary" size="sm"><Printer className="h-4 w-4" /> Labels</Button></Link>
            {b.status !== 2 && <Button variant="danger" size="sm" onClick={() => setRecalling(true)}>Recall</Button>}
          </>
        }
      />
      <Card title="Where the strips are"><Distribution batch={b} /></Card>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Holders right now" className="lg:col-span-2">
          {!affected.data ? <Spinner /> : !affected.data.holders.length ? <Empty title="Nobody holds stock" /> : (
            <ul className="space-y-2 text-sm">
              {affected.data.holders.map((h) => (
                <li key={h.address} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="min-w-0"><Address address={h.address} name={h.name} /><span className="ml-2 text-xs text-slate-500">{ROLES[h.role]}</span></span>
                  <span className="font-semibold tabular-nums text-white">{h.balance}</span>
                </li>
              ))}
              {affected.data.inTransit.map((s) => (
                <li key={s.shipmentId} className="flex items-center justify-between gap-3 rounded-lg bg-info/[0.06] px-3 py-2">
                  <Link href={`/shipment/${s.shipmentId}`} className="text-slate-200 hover:text-brand">Shipment #{s.shipmentId} → {name(s.to) ?? "recipient"}</Link>
                  <span className="font-semibold tabular-nums text-white">{s.quantity}</span>
                </li>
              ))}
              <li className="flex justify-between px-3 pt-2 text-xs text-slate-400"><span>Dispensed to patients</span><span>{affected.data.stripsDispensed}</span></li>
            </ul>
          )}
        </Card>
        <Card title="Journey" className="lg:col-span-3">
          {timeline.isLoading ? <Spinner /> : <Timeline events={timeline.data} />}
        </Card>
      </div>
      {recalling && <RecallModal batch={b} onClose={() => setRecalling(false)} />}
    </div>
  );
}
