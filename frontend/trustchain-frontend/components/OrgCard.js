"use client";
import { MapPin } from "lucide-react";
import { ROLES, date, isSimulated, short } from "@/lib/format";
import { Badge, SimBadge, cx } from "./ui";

export function statLine(role, s) {
  if (!s) return null;
  if (role === 2) return `${s.batchesMade} batches · ${s.stripsMade.toLocaleString()} strips made`;
  if (role === 3) return `${s.shipmentsReceived} received · ${s.shipmentsSent} sent${s.breachFreeRate != null ? ` · ${Math.round(s.breachFreeRate * 100)}% breach-free` : ""}`;
  if (role === 4) return `${s.shipmentsReceived} deliveries · ${s.stripsDispensed} strips dispensed`;
  if (role === 5) return `${s.prescriptionsIssued} prescriptions issued`;
  return null;
}

export default function OrgCard({ org, stats, onClick, selected, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cx("card card-hover w-full p-5 text-left", selected && "border-brand/50 bg-brand/[0.06]")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">{org.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{org.location || "Location not set"}</span>
          </div>
        </div>
        {org.active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <Badge tone="brand">{ROLES[org.role]}</Badge>
        {isSimulated(org) && <SimBadge />}
        {org.licenseId && <span>Licence {org.licenseId}</span>}
        <span>Since {date(org.registeredAt)}</span>
        <span className="font-mono">{short(org.address)}</span>
      </div>
      {statLine(org.role, stats) && <div className="mt-3 text-sm text-slate-300">{statLine(org.role, stats)}</div>}
    </button>
  );
}
