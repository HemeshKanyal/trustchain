"use client";
import { useShipmentsOf } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import ShipmentTable from "@/components/ShipmentTable";
import { Card, PageHeader } from "@/components/ui";

export default function Shipments() {
  const { me } = useWorkspace();
  const ships = useShipmentsOf(me.address);
  return (
    <>
      <PageHeader eyebrow="Shipments" n={4} title="On the road" subtitle="Outgoing shipments with live smart-box status, and returns coming back to you." />
      <Card><ShipmentTable me={me.address} shipments={ships.data} loading={ships.isLoading} /></Card>
    </>
  );
}
