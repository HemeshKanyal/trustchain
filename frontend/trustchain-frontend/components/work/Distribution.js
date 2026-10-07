"use client";
import { useBatchAffected } from "@/lib/hooks";

/** Where a batch's strips are right now: factory / in transit / distributors / pharmacies / sold. */
export default function Distribution({ batch }) {
  const { data: a } = useBatchAffected(batch.id);
  if (!a) return <div className="h-2 animate-pulse rounded-full bg-white/5" />;
  const by = (role) => a.holders.filter((h) => h.role === role).reduce((s, h) => s + h.balance, 0);
  const parts = [
    { label: "Factory", n: by(2), color: "#94a3b8" },
    { label: "In transit", n: a.inTransit.reduce((s, x) => s + x.quantity, 0), color: "#60a5fa" },
    { label: "Distributors", n: by(3), color: "#a78bfa" },
    { label: "Pharmacies", n: by(4), color: "#2dd4bf" },
    { label: "Sold", n: a.stripsDispensed, color: "#34d399" },
  ];
  const total = Math.max(1, batch.quantity);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
        {parts.map((p) => p.n > 0 && <div key={p.label} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {p.n}
          </span>
        ))}
      </div>
    </div>
  );
}
