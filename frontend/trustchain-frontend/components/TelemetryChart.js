"use client";
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { time } from "@/lib/format";

/** samples: [{t, temp_x10, humidity_x10, flags}] ; conditions: {minTempX10, maxTempX10, maxHumidityX10} */
export default function TelemetryChart({ samples, conditions, height = 280 }) {
  const data = (samples ?? []).map((s) => ({
    t: s.t,
    temp: s.temp_x10 == null ? null : s.temp_x10 / 10,
    hum: s.humidity_x10 == null ? null : s.humidity_x10 / 10,
    open: s.flags & 1 ? (s.temp_x10 ?? 0) / 10 : null,
  }));
  const lo = conditions ? Number(conditions.minTempX10) / 10 : null;
  const hi = conditions ? Number(conditions.maxTempX10) / 10 : null;
  const hum = conditions && Number(conditions.maxHumidityX10) ? Number(conditions.maxHumidityX10) / 10 : null;
  const temps = data.map((d) => d.temp).filter((x) => x != null);
  const yMin = Math.floor(Math.min(...temps, lo ?? Infinity) - 2);
  const yMax = Math.ceil(Math.max(...temps, hi ?? -Infinity) + 2);

  return (
    <div style={{ height }} data-testid="telemetry-chart">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={time} stroke="#64748b" fontSize={11} minTickGap={40} />
          <YAxis yAxisId="t" domain={[yMin, yMax]} stroke="#64748b" fontSize={11} unit="°" />
          <YAxis yAxisId="h" orientation="right" domain={[0, 100]} stroke="#64748b" fontSize={11} unit="%" />
          {lo != null && <ReferenceArea yAxisId="t" y1={lo} y2={hi} fill="#2dd4bf" fillOpacity={0.06} stroke="#2dd4bf" strokeOpacity={0.25} strokeDasharray="4 4" />}
          {hum != null && <ReferenceLine yAxisId="h" y={hum} stroke="#60a5fa" strokeOpacity={0.4} strokeDasharray="4 4" />}
          <Tooltip
            contentStyle={{ background: "#0e1528", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(t) => time(t)}
            formatter={(v, n) => (n === "temp" ? [`${v}°C`, "Temperature"] : n === "hum" ? [`${v}%`, "Humidity"] : [v, "Box opened"])}
          />
          <Line yAxisId="h" dataKey="hum" stroke="#60a5fa" strokeOpacity={0.6} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
          <Line yAxisId="t" dataKey="temp" stroke="#2dd4bf" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
          <Scatter yAxisId="t" dataKey="open" fill="#f43f5e" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> Temperature</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-info" /> Humidity</span>
        {lo != null && <span className="flex items-center gap-1.5"><span className="h-3 w-4 border border-dashed border-brand/50 bg-brand/10" /> Allowed {lo}–{hi}°C</span>}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" /> Box opened</span>
      </div>
    </div>
  );
}
