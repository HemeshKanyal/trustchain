"use client";
import { useState } from "react";
import { PackageOpen } from "lucide-react";
import { useApi, useShipmentsOf } from "@/lib/hooks";
import ShipmentCard from "./ShipmentCard";
import ReceiveDialog from "./ReceiveDialog";
import TelemetryChart from "../TelemetryChart";
import { Button, Card, Empty, Notice, Spinner } from "../ui";

function TripChart({ s }) {
  const t = useApi(`/api/shipments/${s.id}/telemetry`, { refetchInterval: 15000 });
  if (!t.data?.samples?.length) return <p className="text-xs text-slate-500">No box readings yet.</p>;
  const breach = t.data.reports.some((r) => r.breach_flags);
  return (
    <>
      {breach && <Notice tone="danger" className="mb-3">Breach on the way: this batch is on hold. Receive it to take custody, but it can&apos;t be sold until the regulator releases it.</Notice>}
      <TelemetryChart samples={t.data.samples} conditions={s.batch?.conditions} height={180} />
    </>
  );
}

export default function Arriving({ me }) {
  const ships = useShipmentsOf(me);
  const [receiving, setReceiving] = useState(null);
  const list = (ships.data ?? []).filter((s) => s.to.toLowerCase() === me.toLowerCase() && s.status === 1);
  if (ships.isLoading) return <Spinner />;
  if (!list.length) return <div className="card"><Empty icon={PackageOpen} title="Nothing arriving">Shipments addressed to you appear here with their smart-box readings.</Empty></div>;
  return (
    <div className="space-y-4">
      {list.map((s) => (
        <Card key={s.id} bodyClassName="grid gap-5 md:grid-cols-5">
          <div className="md:col-span-2">
            <ShipmentCard s={s} me={me} action={<Button onClick={() => setReceiving(s)} data-testid={`receive-${s.id}`}>Receive</Button>} />
          </div>
          <div className="md:col-span-3">
            {s.device === "0x0000000000000000000000000000000000000000" ? <p className="text-sm text-slate-500">Sent without a smart box.</p> : <TripChart s={s} />}
          </div>
        </Card>
      ))}
      {receiving && <ReceiveDialog shipment={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}
