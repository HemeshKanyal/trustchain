"use client";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useApi, useInventory, useShipmentsOf } from "@/lib/hooks";
import DemandCards from "@/components/ai/DemandCards";
import { useWorkspace } from "@/components/Workspace";
import StockMap from "@/components/work/StockMap";
import AlertsFeed from "@/components/AlertsFeed";
import { CountUp } from "@/components/fx/motion";
import { Button, Card, PageHeader } from "@/components/ui";

export default function Overview() {
  const { me } = useWorkspace();
  const inv = useInventory(me.address);
  const ships = useShipmentsOf(me.address);
  const stats = useApi(`/api/orgs/${me.address}/stats`, { refetchInterval: 15000 });
  const mine = (inv.data ?? []).filter((b) => b.mine);
  const ids = mine.slice(0, 8).map((b) => b.id);
  const tiles = [
    ["Strips made", stats.data?.stripsMade],
    ["In your stock", mine.reduce((a, b) => a + b.balance, 0)],
    ["In transit", (ships.data ?? []).filter((s) => s.status === 1 && s.from.toLowerCase() === me.address.toLowerCase()).reduce((a, s) => a + s.quantity, 0)],
    ["Batches", mine.length],
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        n={1}
        title={me.participant.name}
        subtitle={`Manufacturer · ${me.participant.location || "—"} · licence ${me.participant.licenseId || "—"}`}
        actions={<Link href="/manufacturer/batches/new"><Button><PlusCircle className="h-4 w-4" /> New batch</Button></Link>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {tiles.map(([l, v]) => (
          <div key={l} className="card px-5 py-4">
            <div className="text-xs text-slate-400">{l}</div>
            <div className="mt-1 text-3xl font-semibold text-white"><CountUp value={v} /></div>
          </div>
        ))}
      </div>
      <Card title="Where your medicine is now" subtitle="Holders of your 8 most recent batches, and shipments on the road.">
        {ids.length ? <StockMap batchIds={ids} /> : <p className="text-sm text-slate-400">Create a batch to see it on the map.</p>}
      </Card>
      <Card title="Demand for your medicines" subtitle="TrustChain AI forecast of strips dispensed across the network, next 30 days.">
        <DemandCards products={[...new Set(mine.map((b) => b.productName))]} />
      </Card>
      <Card title="Alerts on your batches">
        <AlertsFeed limit={50} match={(a) => mine.some((b) => b.id === a.batchId)} />
      </Card>
    </div>
  );
}
