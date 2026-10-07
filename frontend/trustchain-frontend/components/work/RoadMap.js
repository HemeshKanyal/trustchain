"use client";
import dynamic from "next/dynamic";
import { useParticipants } from "@/lib/hooks";
import { locate } from "@/lib/geo";
import { Spinner } from "../ui";

const RouteMap = dynamic(() => import("../fx/RouteMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

/** Shipments as routes between sender and receiver cities; a box GPS fix (when present) as a dot. */
export default function RoadMap({ shipments, height = 340, focusId, extraPlaces = [] }) {
  const people = useParticipants();
  const at = Object.fromEntries((people.data ?? []).map((p) => [p.address.toLowerCase(), { at: locate(p.location), name: p.name }]));
  const routes = [];
  const places = {};
  for (const s of shipments) {
    const from = s.from ?? s.from_addr;
    const to = s.to ?? s.to_addr;
    const a = at[from.toLowerCase()];
    const b = at[to.toLowerCase()];
    if (a?.at) places[from.toLowerCase()] = { id: from, at: a.at, label: a.name, tone: "slate" };
    if (b?.at) places[to.toLowerCase()] = { id: to, at: b.at, label: b.name, tone: "slate" };
    if (a?.at && b?.at) routes.push({ id: `s${s.id}`, path: [a.at, b.at], tone: s.breached ? "rose" : "teal", dashed: true, label: `Shipment #${s.id}` });
    if (s.lastFix) places[`fix${s.id}`] = { id: `fix${s.id}`, at: [s.lastFix.lat_e6 / 1e6, s.lastFix.lon_e6 / 1e6], label: `Box on shipment #${s.id}`, tone: s.breached ? "rose" : "teal", radius: 9 };
  }
  for (const p of extraPlaces) if (!places[p.id.toLowerCase()]) places[p.id.toLowerCase()] = p;
  return <RouteMap places={Object.values(places)} routes={routes} height={height} focusId={focusId} />;
}
