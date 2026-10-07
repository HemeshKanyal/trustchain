"use client";
import { useState } from "react";
import { BrainCircuit, PackageSearch } from "lucide-react";
import { useAuthedApi, useInventory } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import ForecastChart from "@/components/ai/ForecastChart";
import { CountUp } from "@/components/fx/motion";
import { Badge, Card, Empty, Notice, PageHeader, Select, Spinner } from "@/components/ui";

export default function Forecast() {
  const { me } = useWorkspace();
  const inv = useInventory(me.address);
  const products = [...new Set((inv.data ?? []).map((b) => b.productName))];
  const [picked, setPicked] = useState(null);
  const product = picked ?? products[0] ?? null;
  const q = useAuthedApi(product ? `/api/ai/forecast?product=${encodeURIComponent(product)}&pharmacy=${me.address}&horizon=30` : null, me.address, { refetchInterval: 30000 });
  const f = q.data;
  const sum = (n) => (f ? Math.round(f.forecast.slice(0, n).reduce((s, p) => s + p.mean, 0)) : null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forecast"
        n={5}
        title="What you'll sell next"
        subtitle="TrustChain AI forecasts demand from your dispensing on the chain and tells you when to reorder."
        actions={products.length > 0 && (
          <Select value={product ?? ""} onChange={(e) => setPicked(e.target.value)} className="w-auto" aria-label="Medicine" data-testid="forecast-product">
            {products.map((p) => <option key={p}>{p}</option>)}
          </Select>
        )}
      />
      {inv.isLoading ? <Spinner /> : !products.length ? (
        <div className="card"><Empty icon={PackageSearch} title="Nothing to forecast yet">Receive stock and dispense it; forecasts appear here.</Empty></div>
      ) : !f ? <Spinner label="Forecasting…" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-testid="forecast-tiles">
            {[["Next 7 days", sum(7), "strips"], ["Next 30 days", sum(30), "strips"], ["In stock", f.stock, "sellable strips"], ["Days of cover", f.daysOfCover == null ? "30+" : f.daysOfCover < 1 ? "<1" : Math.floor(f.daysOfCover), f.daysOfCover != null && f.daysOfCover < 7 ? "reorder soon" : "at forecast pace"]].map(([l, v, sub]) => (
              <div key={l} className="card px-5 py-4">
                <div className="text-xs text-slate-400">{l}</div>
                <div className="mt-1 text-3xl font-extrabold text-white">{typeof v === "number" ? <CountUp value={v} /> : v}</div>
                <div className="text-xs text-slate-500">{sub}</div>
              </div>
            ))}
          </div>
          {f.reorder > 0 && (
            <Notice tone="warn" icon={BrainCircuit} title={`Reorder about ${f.reorder} strips`}>
              At the forecast pace your stock runs out {f.daysOfCover < 1 ? "in less than a day" : `in about ${Math.floor(f.daysOfCover)} day${Math.floor(f.daysOfCover) === 1 ? "" : "s"}`}. This covers the next 14 days plus a 20% safety margin.
            </Notice>
          )}
          <Card
            title={product}
            subtitle={`${f.method} · ${f.historyDays} day${f.historyDays === 1 ? "" : "s"} of your sales history`}
            actions={f.backtest?.wape != null ? <Badge tone={f.backtest.wape < 0.3 ? "ok" : "warn"}>Last 14 days: within {Math.round(f.backtest.wape * 100)}%</Badge> : <Badge>Accuracy shown after 30 days of sales</Badge>}
          >
            <ForecastChart data={f} />
          </Card>
          <p className="text-xs text-slate-500">
            {f.historyDays < 16 ? "With under two weeks of sales the forecast is a smoothed average; it learns your weekly pattern once there is more history. " : "Holt-Winters model with a weekly cycle, tuned automatically on your history. "}
            {f.market && `Market reference: ₹${Math.round(f.market.medianPrice)} median price (${f.market.source}).`}
          </p>
        </>
      )}
    </div>
  );
}
