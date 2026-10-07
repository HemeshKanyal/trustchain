"use client";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Empty, Spinner } from "../ui";

export default function DemandCards({ products }) {
  const qs = useQueries({ queries: products.map((p) => ({ queryKey: ["api", `/api/ai/forecast?product=${encodeURIComponent(p)}`], queryFn: () => api(`/api/ai/forecast?product=${encodeURIComponent(p)}`), refetchInterval: 60000 })) });
  if (!products.length) return <Empty title="No products yet" />;
  if (qs.some((q) => q.isLoading)) return <Spinner />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="demand-cards">
      {qs.map((q, i) => {
        const f = q.data;
        if (!f) return null;
        const next = Math.round(f.forecast.reduce((s, p) => s + p.mean, 0));
        const past = f.history.slice(-30).reduce((s, h) => s + h.units, 0);
        const max = Math.max(1, ...f.history.slice(-30).map((h) => h.units), ...f.forecast.map((p) => p.mean));
        return (
          <div key={products[i]} className="rounded-xl bg-white/[0.03] p-4">
            <div className="truncate font-medium text-white">{products[i]}</div>
            <div className="mt-1 text-3xl font-extrabold text-white">{next}</div>
            <div className="text-xs text-slate-400">strips expected in 30 days · {past} sold in the last 30</div>
            <div className="mt-3 flex h-10 items-end gap-px">
              {f.history.slice(-30).map((h, k) => <div key={`h${k}`} className="flex-1 rounded-t bg-info/50" style={{ height: `${(h.units / max) * 100}%` }} />)}
              {f.forecast.map((p, k) => <div key={`f${k}`} className="flex-1 rounded-t bg-brand/40" style={{ height: `${(p.mean / max) * 100}%` }} />)}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{f.method}</div>
          </div>
        );
      })}
    </div>
  );
}
