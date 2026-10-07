"use client";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

const COLOR = { teal: "#2dd4bf", rose: "#f43f5e", amber: "#fbbf24", blue: "#60a5fa", slate: "#94a3b8" };

function Fit({ points, focus }) {
  const map = useMap();
  const key = JSON.stringify([points, focus]);
  useEffect(() => {
    const target = focus?.length ? focus : points;
    if (target.length === 1) map.flyTo(target[0], 7, { duration: 0.8 });
    else if (target.length > 1) map.flyToBounds(target, { padding: [60, 60], maxZoom: 8, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Dark map. places: [{id, at:[lat,lon], label, tone}], routes: [{id, path:[[lat,lon],...], tone, dashed, label}] */
export default function RouteMap({ places = [], routes = [], height = 360, onSelect, focusId }) {
  const points = [...places.map((p) => p.at), ...routes.flatMap((r) => r.path)];
  const focus = focusId ? [...routes.filter((r) => r.id === focusId).flatMap((r) => r.path), ...places.filter((p) => p.id === focusId).map((p) => p.at)] : null;
  return (
    // clip-path (not just overflow:hidden + radius) reliably clips the GPU-composited, filtered tile layer
    <div className="overflow-hidden rounded-2xl border border-white/10" style={{ height, clipPath: "inset(0 round 1rem)", isolation: "isolate" }} data-testid="route-map">
      <MapContainer center={[22.5, 79]} zoom={5} scrollWheelZoom={false} style={{ height: "100%", background: "#05070f" }} attributionControl>
        {/* Keyless OpenStreetMap tiles, darkened in CSS (.tc-dark-tiles) to match the site. */}
        <TileLayer
          url={process.env.NEXT_PUBLIC_MAP_TILES ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
          className="tc-dark-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Fit points={points} focus={focus} />
        {routes.map((r) => (
          <Polyline
            key={r.id}
            positions={r.path}
            pathOptions={{ color: COLOR[r.tone] ?? COLOR.teal, weight: 2.5, opacity: 0.85, dashArray: r.dashed ? "6 8" : undefined }}
            eventHandlers={onSelect ? { click: () => onSelect(r.id) } : undefined}
          >
            {r.label && <Tooltip sticky>{r.label}</Tooltip>}
          </Polyline>
        ))}
        {places.map((p) => (
          <CircleMarker
            key={p.id}
            center={p.at}
            radius={p.radius ?? 7}
            pathOptions={{ color: COLOR[p.tone] ?? COLOR.teal, fillColor: COLOR[p.tone] ?? COLOR.teal, fillOpacity: 0.6, weight: 2 }}
            eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
          >
            {p.label && <Tooltip direction="top">{p.label}</Tooltip>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
