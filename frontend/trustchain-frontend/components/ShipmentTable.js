"use client";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Radio, Truck } from "lucide-react";
import { useNames, useTelemetrySummary } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { dateTime, short, ZERO } from "@/lib/format";
import { useState } from "react";
import { Badge, Button, Empty, Spinner } from "./ui";
import ReceiveDialog from "./work/ReceiveDialog";
import { ShipmentStatus } from "./status";

export default function ShipmentTable({ me, shipments, loading, filter = "all", empty = "No shipments yet" }) {
  const name = useNames();
  const { send } = useTx();
  const [receiving, setReceiving] = useState(null);
  if (loading) return <Spinner />;
  const rows = (shipments ?? []).filter((s) => {
    const incoming = s.to.toLowerCase() === me.toLowerCase();
    if (filter === "incoming") return incoming && s.status === 1;
    if (filter === "outgoing") return !incoming;
    return true;
  });
  if (!rows.length) return <Empty icon={Truck} title={empty} />;

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="pl-5">Shipment</th>
            <th>Medicine</th>
            <th>From / to</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Smart box</th>
            <th className="pr-5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const incoming = s.to.toLowerCase() === me.toLowerCase();
            const other = incoming ? s.from : s.to;
            return (
              <tr key={s.id} data-testid={`shipment-row-${s.id}`}>
                <td className="pl-5">
                  <Link href={`/shipment/${s.id}`} className="font-medium text-white hover:text-brand">
                    #{s.id}
                  </Link>
                  <div className="text-xs text-slate-500">{dateTime(s.createdAt)}</div>
                </td>
                <td>
                  <div className="text-slate-100">{s.batch?.productName}</div>
                  <div className="text-xs text-slate-500">batch #{s.batchId}</div>
                </td>
                <td>
                  <span className="flex items-center gap-1.5">
                    {incoming ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" />}
                    <span className="text-xs text-slate-400">{incoming ? "from" : "to"}</span> {name(other) ?? short(other)}
                  </span>
                </td>
                <td className="tabular-nums">{s.quantity}</td>
                <td>
                  <ShipmentStatus status={s.status} />
                </td>
                <td>{s.device === ZERO ? <span className="text-xs text-slate-500">none</span> : <BoxStatus shipmentId={s.id} />}</td>
                <td className="pr-5 text-right">
                  <div className="flex justify-end gap-2">
                    {s.status === 1 && incoming && (
                      <>
                        <Button size="sm" onClick={() => setReceiving(s)} data-testid={`receive-${s.id}`}>
                          Receive
                        </Button>
                      </>
                    )}
                    {s.status === 1 && !incoming && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => send({ contract: trustChain, functionName: "cancelShipment", args: [BigInt(s.id)], label: `Cancel shipment #${s.id}` })}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {receiving && <ReceiveDialog shipment={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}

export function BoxStatus({ shipmentId }) {
  const { data: t } = useTelemetrySummary(shipmentId);
  if (!t) return <Badge>…</Badge>;
  if (Number(t.breachCount) > 0) return <Badge tone="danger">Breach ×{Number(t.breachCount)}</Badge>;
  if (Number(t.reportCount) === 0) return <Badge tone="neutral">Awaiting data</Badge>;
  return (
    <Badge tone="ok">
      <Radio className="h-3 w-3" /> {Number(t.reportCount)} reports OK
    </Badge>
  );
}
