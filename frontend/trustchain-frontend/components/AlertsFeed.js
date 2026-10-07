"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, Ban, BellRing, PauseCircle, ShieldCheck, Thermometer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi, useAuthedApi, useNames } from "@/lib/hooks";
import { API_URL } from "@/lib/config";
import { dateTime, short } from "@/lib/format";
import { Badge, Empty, Spinner, cx } from "./ui";

const META = {
  breach: { icon: Thermometer, tone: "danger", title: "Cold-chain breach" },
  quarantine: { icon: PauseCircle, tone: "warn", title: "Batch put on hold" },
  recall: { icon: Ban, tone: "danger", title: "Batch recalled" },
  quarantine_released: { icon: ShieldCheck, tone: "ok", title: "Hold released" },
};

/** Live alerts (initial list + Server-Sent Events). `showPatients` reveals affected patient addresses (admin only). */
export default function AlertsFeed({ limit = 30, showPatients = false, match, authAddress }) {
  const qc = useQueryClient();
  const pub = useApi(`/api/alerts?limit=${limit}`, { refetchInterval: 30000, enabled: !authAddress });
  const priv = useAuthedApi(`/api/alerts?limit=${limit}`, authAddress, { refetchInterval: 30000 });
  const { data, isLoading, error } = authAddress ? priv : pub;
  const [live, setLive] = useState(false);
  const name = useNames();

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/alerts/stream`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("alert", () => {
      qc.invalidateQueries({ queryKey: ["api"] });
      qc.invalidateQueries({ queryKey: ["api-auth"] });
    });
    return () => es.close();
  }, [qc]);

  if (isLoading) return <Spinner />;
  if (error) return <div className="text-sm text-slate-400">Alerts service unavailable ({error.message}).</div>;
  const list = (data ?? []).filter((a) => !match || match(a));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
        <span className={cx("h-2 w-2 rounded-full", live ? "animate-pulse bg-ok" : "bg-slate-600")} />
        {live ? "Live" : "Reconnecting…"}
      </div>
      {!list.length ? (
        <Empty icon={BellRing} title="No alerts">Breaches, holds and recalls will appear here instantly.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const m = META[a.type] ?? { icon: AlertOctagon, tone: "neutral", title: a.type };
            const Icon = m.icon;
            const af = a.details?.affected;
            return (
              <li key={a.id} className="rounded-xl border border-white/[0.07] bg-ink-950/40 p-4" data-testid="alert-item" data-type={a.type}>
                <div className="flex items-start gap-3">
                  <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", m.tone === "danger" ? "text-rose-400" : m.tone === "warn" ? "text-amber-300" : "text-emerald-300")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{m.title}</span>
                      <Link href={`/batch/${a.batchId}`}>
                        <Badge tone="brand">batch #{a.batchId}</Badge>
                      </Link>
                      {a.shipmentId && (
                        <Link href={`/shipment/${a.shipmentId}`}>
                          <Badge>shipment #{a.shipmentId}</Badge>
                        </Link>
                      )}
                      <span className="text-xs text-slate-500">{dateTime(a.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {a.details?.reasons?.join(", ") || a.details?.reason || a.details?.note}
                    </div>
                    {af && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {af.holders?.length > 0 && <span>Holding stock: {af.holders.map((h) => `${h.name} (${h.balance})`).join(", ")}</span>}
                        {af.inTransit?.length > 0 && <span>In transit: {af.inTransit.length} shipment(s)</span>}
                        <span>
                          Patients affected: <b className="text-slate-200">{af.patients?.length ?? af.patientCount ?? 0}</b>
                          {showPatients && af.patients?.length > 0 && ` (${af.patients.map((p) => name(p) ?? short(p)).join(", ")})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
