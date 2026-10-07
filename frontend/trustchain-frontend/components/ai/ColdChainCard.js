"use client";
import { BrainCircuit } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { dateTime } from "@/lib/format";
import { Badge, Card, Spinner } from "../ui";

const tone = { critical: "danger", warning: "warn", info: "ok" };

/** Pharma-grade summary of one trip: MKT, time out of range, excursions, anomaly score. */
export default function ColdChainCard({ shipmentId }) {
  const { data, isLoading } = useApi(`/api/ai/shipments/${shipmentId}/coldchain`, { refetchInterval: 15000 });
  if (isLoading) return <Spinner />;
  if (!data?.monitored || !data.analysis?.samples) return null;
  const a = data.analysis;
  const tiles = [
    ["Mean kinetic temp.", a.mkt != null ? `${a.mkt.toFixed(1)}°C` : "—"],
    ["Out of range", `${a.excursionMinutes} min`],
    ["Box opened", `${a.tamperEvents}×`],
    ["Offline gaps", `${a.gapMinutes} min`],
  ];
  return (
    <Card
      title={<span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-brand" /> Cold-chain analysis</span>}
      subtitle={`${a.samples} readings over ${a.durationMinutes} min${data.anomaly != null ? ` · anomaly score ${data.anomaly.toFixed(2)} vs ${data.tripsModelled} trips` : ""}`}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="coldchain-card">
        {tiles.map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white/[0.03] px-4 py-3">
            <div className="text-xs text-slate-400">{l}</div>
            <div className="mt-1 text-xl font-bold text-white">{v}</div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {a.findings.map((f) => (
          <li key={f.code} className="flex items-start gap-2 text-sm text-slate-200">
            <Badge tone={tone[f.severity]}>{f.severity}</Badge>
            {f.text}
          </li>
        ))}
      </ul>
      {a.excursions.length > 0 && (
        <div className="mt-4 text-xs text-slate-400">
          Excursions: {a.excursions.map((e) => `${e.kind === "hot" ? "above" : "below"} range ${dateTime(e.start)} for ${e.minutes} min (peak ${e.peak}°C)`).join(" · ")}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">MKT is the single temperature that would cause the same degradation as the whole trip (ICH Q1A, ΔH = 83.144 kJ/mol).</p>
    </Card>
  );
}
