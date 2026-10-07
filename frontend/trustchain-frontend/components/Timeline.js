"use client";
import Link from "next/link";
import { AlertTriangle, Ban, Factory, PackageCheck, Pill, QrCode, ShieldCheck, Thermometer, Truck, XCircle } from "lucide-react";
import { dateTime, reasons, short, temp } from "@/lib/format";
import { useNames } from "@/lib/hooks";
import { cx } from "./ui";
import { Reveal } from "./fx/motion";

/** Collapse raw chain events into human steps (telemetry runs and multi-strip dispenses are grouped). */
function group(events) {
  const out = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (e.name === "TelemetryRecorded") {
      const a = e.args;
      if (last?.kind === "telemetry" && last.shipmentId === a.shipmentId) {
        last.count++;
        last.min = Math.min(last.min, Number(a.minTempX10));
        last.max = Math.max(last.max, Number(a.maxTempX10));
        last.tamper ||= a.tamper;
        last.end = e.timestamp;
        continue;
      }
      out.push({ kind: "telemetry", shipmentId: a.shipmentId, count: 1, min: Number(a.minTempX10), max: Number(a.maxTempX10), tamper: a.tamper, timestamp: e.timestamp, end: e.timestamp });
      continue;
    }
    if (e.name === "StripDispensed" && last?.kind === "StripDispensed" && last.tx_hash === e.tx_hash) {
      last.count++;
      continue;
    }
    if (e.name === "BatchQuarantined" && last?.kind === "BreachDetected" && last.tx_hash === e.tx_hash) continue;
    out.push({ kind: e.name, ...e, count: 1 });
  }
  return out;
}

export default function Timeline({ events, redactPatients = true }) {
  const name = useNames();
  const who = (a) => name(a) ?? short(a);
  const items = group(events ?? []);

  const render = (it) => {
    const a = it.args ?? {};
    switch (it.kind) {
      case "BatchCreated":
        return { icon: Factory, tone: "brand", title: `Manufactured by ${who(a.manufacturer)}`, body: `${a.productName} · lot ${a.lotNumber} · ${a.quantity} strips` };
      case "StripsRegistered":
        return { icon: QrCode, tone: "brand", title: `${a.count} strips serialised`, body: "Each strip received a unique QR code; only its hash is on-chain." };
      case "ShipmentCreated":
        return {
          icon: Truck,
          tone: "info",
          title: `Shipped: ${who(a.from)} → ${who(a.to)}`,
          body: (
            <>
              {a.quantity} strips{" "}
              {a.device !== "0x0000000000000000000000000000000000000000" ? "in a monitored smart box" : "without a smart box"} ·{" "}
              <Link className="text-brand hover:underline" href={`/shipment/${a.shipmentId}`}>
                shipment #{a.shipmentId}
              </Link>
            </>
          ),
        };
      case "ShipmentDelivered":
        return { icon: PackageCheck, tone: "ok", title: `Received by ${who(a.to)}`, body: `Custody transferred (shipment #${a.shipmentId})` };
      case "ShipmentCancelled":
        return { icon: XCircle, tone: "neutral", title: `Shipment #${a.shipmentId} cancelled`, body: `by ${who(a.by)}; stock returned to sender` };
      case "telemetry":
        return {
          icon: Thermometer,
          tone: it.tamper ? "danger" : "info",
          title: `${it.count} signed smart-box report${it.count > 1 ? "s" : ""}`,
          body: `${temp(it.min)} – ${temp(it.max)}${it.tamper ? " · box opened / sensor fault" : ""}`,
          time: it.count > 1 ? `${dateTime(it.timestamp)} – ${dateTime(it.end)}` : undefined,
        };
      case "BreachDetected":
        return { icon: AlertTriangle, tone: "danger", title: "Cold-chain breach: batch quarantined", body: reasons(a.reasonFlags).join(", ") };
      case "BatchQuarantined":
        return { icon: AlertTriangle, tone: "warn", title: "Batch put on hold", body: `${reasons(a.reasonFlags).join(", ")} · by ${who(a.by)}` };
      case "QuarantineReleased":
        return { icon: ShieldCheck, tone: "ok", title: "Hold released by regulator", body: a.note };
      case "StripDispensed":
        return {
          icon: Pill,
          tone: "ok",
          title: `${it.count} strip${it.count > 1 ? "s" : ""} dispensed by ${who(a.pharmacy)}`,
          body: `${Number(a.prescriptionId) ? `against prescription #${a.prescriptionId}` : "over the counter"}${redactPatients ? "" : ` · patient ${short(a.patient)}`}`,
        };
      case "BatchRecalled":
        return { icon: Ban, tone: "danger", title: `Recalled by ${who(a.by)}`, body: a.reason };
      default:
        return { icon: QrCode, tone: "neutral", title: it.kind };
    }
  };

  const toneCls = {
    brand: "bg-brand/15 text-brand ring-brand/30",
    info: "bg-info/15 text-blue-300 ring-info/30",
    ok: "bg-ok/15 text-emerald-300 ring-ok/30",
    warn: "bg-warn/15 text-amber-300 ring-warn/30",
    danger: "bg-danger/15 text-rose-300 ring-danger/30",
    neutral: "bg-white/5 text-slate-400 ring-white/10",
  };

  return (
    <ol className="relative">
      {items.map((it, i) => {
        const r = render(it);
        const Icon = r.icon;
        return (
          <Reveal as="li" key={i} delay={Math.min(i, 8) * 0.03} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-gradient-to-b from-brand/60 to-brand/10 shadow-[0_0_8px_rgba(45,212,191,0.5)]" />}
            <span className={cx("relative grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1", toneCls[r.tone])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-1">
              <div className="text-sm font-medium text-slate-100">{r.title}</div>
              {r.body && <div className="mt-0.5 text-sm text-slate-400">{r.body}</div>}
              <div className="mt-1 text-xs text-slate-500">{r.time ?? dateTime(it.timestamp)}</div>
            </div>
          </Reveal>
        );
      })}
    </ol>
  );
}
