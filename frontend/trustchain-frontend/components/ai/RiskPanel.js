"use client";
import { AlertOctagon, BrainCircuit, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { Spinner, cx } from "../ui";

const LEVEL = {
  low: { label: "Low risk", color: "#34d399", text: "text-emerald-300" },
  medium: { label: "Medium risk", color: "#fbbf24", text: "text-amber-300" },
  high: { label: "High risk", color: "#f43f5e", text: "text-rose-400" },
};
const ICON = { critical: AlertOctagon, warning: TriangleAlert, info: Info };

/** Semi-circular gauge 0–100. */
function Gauge({ score, color }) {
  const r = 52;
  const len = Math.PI * r;
  return (
    <svg viewBox="0 0 120 70" className="w-36" aria-hidden="true">
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * len} ${len}`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="60" y="58" textAnchor="middle" fill="white" fontSize="24" fontWeight="800">{score}</text>
    </svg>
  );
}

/** TrustChain AI verdict on a batch: score, level and the reasons behind it. */
export default function RiskPanel({ batchId, compact = false }) {
  const { data, isLoading, error } = useApi(batchId ? `/api/ai/batches/${batchId}/risk` : null, { refetchInterval: 15000 });
  if (isLoading) return <Spinner label="TrustChain AI is analysing this batch…" />;
  if (error || !data) return null;
  const L = LEVEL[data.level];
  const reasons = data.reasons;
  return (
    <div className={cx("card overflow-hidden", data.level === "high" && "border-danger/40", data.level === "medium" && "border-warn/30")} data-testid="risk-panel" data-level={data.level}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Gauge score={data.score} color={L.color} />
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-300">
              <BrainCircuit className="h-3.5 w-3.5" /> TrustChain AI
            </div>
            <div className={cx("mt-1 text-2xl font-extrabold", L.text)}>{L.label}</div>
            <div className="text-xs text-slate-400">
              {data.signals.monitoredTrips}/{data.signals.trips} trips monitored · {data.signals.priceReports} price report{data.signals.priceReports === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {!reasons.length && (
            <li className="flex items-start gap-2 text-sm text-slate-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> No warning signs in its cold chain, packaging scans or prices.
            </li>
          )}
          {(compact ? reasons.slice(0, 3) : reasons).map((r) => {
            const Icon = ICON[r.severity];
            return (
              <li key={r.code} className="flex items-start gap-2 text-sm" data-testid="risk-reason" data-code={r.code}>
                <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", r.severity === "critical" ? "text-rose-400" : r.severity === "warning" ? "text-amber-300" : "text-slate-400")} />
                <span className="text-slate-200">
                  {r.text}
                  {r.repeats > 1 && <span className="text-slate-500"> (×{r.repeats})</span>}
                </span>
              </li>
            );
          })}
          {compact && reasons.length > 3 && <li className="text-xs text-slate-500">+{reasons.length - 3} more on the batch page</li>}
        </ul>
      </div>
    </div>
  );
}
