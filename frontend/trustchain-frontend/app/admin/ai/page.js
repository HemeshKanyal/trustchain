"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, BrainCircuit, Info, TriangleAlert } from "lucide-react";
import { useAuthedApi } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { ROLES, dateTime, short } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Spinner, Tabs, cx } from "@/components/ui";

const LV = { high: "danger", medium: "warn", low: "ok" };
const ICON = { critical: AlertOctagon, warning: TriangleAlert, info: Info };

export default function AiRisk() {
  const { me } = useWorkspace();
  const q = useAuthedApi("/api/ai/overview", me.address, { refetchInterval: 20000 });
  const [tab, setTab] = useState("batches");
  const d = q.data;
  if (q.isLoading || !d) return <Spinner label="TrustChain AI is analysing the network…" />;
  const atRisk = d.batches.filter((b) => b.level !== "low");
  const weak = d.compliance.filter((c) => c.score < 90);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AI risk" n={8} title="What needs attention" subtitle="Cold chain, packaging scans, prices and compliance, scored across the whole network." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[["Batches at risk", atRisk.length, atRisk.length ? "danger" : "ok"], ["Organisations below A", weak.length, weak.length ? "warn" : "ok"], ["Unknown-code scans (30 d)", d.scans.unknown, d.scans.burst ? "danger" : null], ["Price anomalies", d.prices.length, d.prices.length ? "warn" : "ok"]].map(([l, v, t]) => (
          <div key={l} className="card px-5 py-4">
            <div className="text-xs text-slate-400">{l}</div>
            <div className={cx("mt-1 text-3xl font-extrabold", t === "danger" ? "text-rose-300" : t === "warn" ? "text-amber-300" : "text-white")}>{v}</div>
          </div>
        ))}
      </div>
      {d.scans.burst && (
        <div className="card border-danger/40 p-4 text-sm text-rose-200">
          <AlertOctagon className="mr-2 inline h-4 w-4" /> Counterfeit wave: {d.scans.today} scans of unregistered codes today against a usual {d.scans.mean.toFixed(1)} a day.
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "batches", label: "Batches", count: atRisk.length },
          { id: "compliance", label: "Compliance", count: weak.length },
          { id: "scans", label: "Packaging scans", count: d.scans.clones.length },
          { id: "prices", label: "Prices", count: d.prices.length },
        ]}
      />
      {tab === "batches" && (
        <div className="space-y-3" data-testid="ai-batches">
          {d.batches.map((b) => (
            <div key={b.batchId} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/batch/${b.batchId}`} className="font-semibold text-white hover:text-brand">#{b.batchId} {b.productName} <span className="text-xs font-normal text-slate-500">lot {b.lotNumber}</span></Link>
                <Badge tone={LV[b.level]}>{b.score} · {b.level} risk</Badge>
              </div>
              {b.reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {b.reasons.map((r) => {
                    const I = ICON[r.severity];
                    return <li key={r.code} className="flex items-start gap-2 text-sm text-slate-300"><I className={cx("mt-0.5 h-4 w-4 shrink-0", r.severity === "critical" ? "text-rose-400" : r.severity === "warning" ? "text-amber-300" : "text-slate-500")} />{r.text}</li>;
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "compliance" && (
        <div className="grid gap-3 md:grid-cols-2" data-testid="ai-compliance">
          {d.compliance.map((c) => (
            <div key={c.address} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/network/${c.address}`} className="font-semibold text-white hover:text-brand">{c.name}</Link>
                <Badge tone={c.score >= 90 ? "ok" : c.score >= 55 ? "warn" : "danger"}>{c.grade} · {c.score}/100</Badge>
              </div>
              <div className="text-xs text-slate-500">{ROLES[c.role]} · {short(c.address)}</div>
              {c.issues.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{c.issues.map((i) => <li key={i.code}>−{i.penalty} · {i.text}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No issues found.</p>}
            </div>
          ))}
        </div>
      )}
      {tab === "scans" && (
        <Card title="Packaging-scan intelligence" subtitle={`${d.scans.total} anonymous scans in 30 days · ${d.scans.unknown} of unregistered codes`}>
          <div className="flex h-16 items-end gap-1" aria-label="Unknown-code scans per day">
            {d.scans.counts.map((n, i) => <div key={i} className={cx("flex-1 rounded-t", i === d.scans.counts.length - 1 && d.scans.burst ? "bg-danger" : "bg-info/50")} style={{ height: `${Math.max(4, (n / Math.max(1, ...d.scans.counts)) * 100)}%` }} title={`${n}`} />)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Unknown-code scans per day, last 30 days</div>
          <div className="mt-5">
            {!d.scans.clones.length ? <Empty title="No copied codes detected" /> : (
              <ul className="space-y-2">{d.scans.clones.map((c, i) => <li key={i} className="text-sm text-rose-200"><Link className="font-medium hover:underline" href={`/batch/${c.batchId}`}>#{c.batchId} {c.productName}</Link>: {c.text}</li>)}</ul>
            )}
          </div>
        </Card>
      )}
      {tab === "prices" && (
        <Card title="Prices far from market">
          {!d.prices.length ? <Empty title="No price anomalies" /> : (
            <ul className="space-y-2 text-sm">
              {d.prices.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-slate-200">{p.finding.text}</span><span className="text-xs text-slate-500">{p.source} · batch #{p.batch_id} · {dateTime(p.created_at)}</span></li>)}
            </ul>
          )}
        </Card>
      )}
      <p className="flex items-center gap-1.5 text-xs text-slate-500"><BrainCircuit className="h-3.5 w-3.5" /> Anomaly model: {d.model.anomaly ?? `needs 8+ monitored trips (has ${d.model.tripsModelled})`} · reference prices: {d.model.market}</p>
    </div>
  );
}
