import { Badge } from "./ui";
import { BATCH_STATUS, SHIPMENT_STATUS, isExpired, reasons } from "@/lib/format";

export function BatchStatus({ batch }) {
  if (!batch) return null;
  if (batch.status === 2) return <Badge tone="danger">Recalled</Badge>;
  if (batch.status === 1) return <Badge tone="warn">Quarantined</Badge>;
  if (isExpired(batch.expiresAt)) return <Badge tone="danger">Expired</Badge>;
  return <Badge tone="ok">{BATCH_STATUS[0]}</Badge>;
}

export function ShipmentStatus({ status }) {
  const tone = status === 1 ? "info" : status === 2 ? "ok" : "neutral";
  return <Badge tone={tone}>{SHIPMENT_STATUS[status]}</Badge>;
}

export function BreachBadges({ flags }) {
  const list = reasons(flags);
  if (!list.length) return <Badge tone="ok">Within limits</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((r) => (
        <Badge key={r} tone="danger">
          {r}
        </Badge>
      ))}
    </span>
  );
}

export function rxStatus(p) {
  if (p.cancelled) return <Badge>Cancelled</Badge>;
  if (p.dispensed >= p.allowance) return <Badge tone="neutral">Fully dispensed</Badge>;
  if (isExpired(p.validUntil)) return <Badge tone="danger">Expired</Badge>;
  return <Badge tone="ok">Active</Badge>;
}
