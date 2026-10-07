"use client";
import Link from "next/link";
import { useNames } from "@/lib/hooks";
import { dateTime, short, ZERO } from "@/lib/format";
import { BoxStatus } from "../ShipmentTable";
import { Badge } from "../ui";

export default function ShipmentCard({ s, me, action }) {
  const name = useNames();
  const incoming = s.to.toLowerCase() === me.toLowerCase();
  const other = incoming ? s.from : s.to;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4" data-testid={`shipment-card-${s.id}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/shipment/${s.id}`} className="font-medium text-white hover:text-brand">{s.batch?.productName}</Link>
        {s.device === ZERO ? <Badge>no box</Badge> : <BoxStatus shipmentId={s.id} />}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        #{s.id} · {s.quantity} strips · {incoming ? "from" : "to"} {name(other) ?? short(other)}
      </div>
      <div className="mt-1 text-xs text-slate-500">{dateTime(s.createdAt)}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
