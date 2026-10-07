"use client";
import dynamic from "next/dynamic";
import { useQueries } from "@tanstack/react-query";
import { useParticipants } from "@/lib/hooks";
import { api } from "@/lib/api";
import { locate } from "@/lib/geo";
import { Spinner } from "../ui";

const RouteMap = dynamic(() => import("../fx/RouteMap"), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

/** Map of where a set of batches' strips are now (holders) and moving (in-transit shipments). */
export default function StockMap({ batchIds, height = 320 }) {
  const people = useParticipants();
  const qs = useQueries({ queries: batchIds.map((id) => ({ queryKey: ["api", `/api/batches/${id}/affected`], queryFn: () => api(`/api/batches/${id}/affected`), refetchInterval: 20000 })) });
  const where = Object.fromEntries((people.data ?? []).map((p) => [p.address.toLowerCase(), { at: locate(p.location), name: p.name }]));
  const holders = {};
  const routes = [];
  qs.forEach((q, i) => {
    for (const h of q.data?.holders ?? []) {
      const w = where[h.address.toLowerCase()];
      if (!w?.at) continue;
      const k = h.address.toLowerCase();
      holders[k] = { id: k, at: w.at, label: `${w.name}: ${(holders[k]?.n ?? 0) + h.balance} strips`, n: (holders[k]?.n ?? 0) + h.balance, tone: h.role === 2 ? "slate" : h.role === 4 ? "teal" : "blue" };
    }
    for (const s of q.data?.inTransit ?? []) {
      const a = where[s.from.toLowerCase()]?.at;
      const b = where[s.to.toLowerCase()]?.at;
      if (a && b) routes.push({ id: `s${s.shipmentId}-${batchIds[i]}`, path: [a, b], tone: "teal", dashed: true, label: `Shipment #${s.shipmentId}: ${s.quantity} strips` });
    }
  });
  return <RouteMap places={Object.values(holders)} routes={routes} height={height} />;
}
