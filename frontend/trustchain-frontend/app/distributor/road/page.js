"use client";
import { useShipmentsOf } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import RoadMap from "@/components/work/RoadMap";
import ShipmentTable from "@/components/ShipmentTable";
import { Card, PageHeader } from "@/components/ui";

export default function Page() {
  const { me } = useWorkspace();
  const ships = useShipmentsOf(me.address);
  const out = (ships.data ?? []).filter((s) => s.from.toLowerCase() === me.address.toLowerCase());
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="On the road" n={4} title="Your shipments" />
      <Card><RoadMap shipments={out.filter((s) => s.status === 1)} /></Card>
      <Card title="All outgoing"><ShipmentTable me={me.address} shipments={out} loading={ships.isLoading} /></Card>
    </div>
  );
}
