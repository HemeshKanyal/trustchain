"use client";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { date } from "@/lib/format";

/** Daily history (bars) and forecast (line with 80% band). */
export default function ForecastChart({ data, height = 260 }) {
  const rows = [
    ...(data.history ?? []).slice(-45).map((h) => ({ day: h.day, actual: h.units })),
    ...(data.forecast ?? []).map((f) => ({ day: f.day, mean: Math.round(f.mean * 10) / 10, band: [Math.round(f.lo * 10) / 10, Math.round(f.hi * 10) / 10] })),
  ];
  return (
    <div style={{ height }} data-testid="forecast-chart">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => date(d).replace(/ \d{4}$/, "")} stroke="#64748b" fontSize={11} minTickGap={30} />
          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#0c1222", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(d) => date(d)}
            formatter={(v, n) => (n === "band" ? [`${v[0]}–${v[1]}`, "Likely range"] : [v, n === "actual" ? "Strips sold" : "Forecast"])}
          />
          <Bar dataKey="actual" fill="#60a5fa" fillOpacity={0.6} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Area dataKey="band" stroke="none" fill="#2dd4bf" fillOpacity={0.12} isAnimationActive={false} />
          <Line dataKey="mean" stroke="#2dd4bf" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-info/60" /> Strips sold per day</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> Forecast</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-4 bg-brand/15" /> 80% likely range</span>
      </div>
    </div>
  );
}
