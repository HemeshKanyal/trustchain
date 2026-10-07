"use client";
import { useInventory } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import InventoryTable from "@/components/InventoryTable";
import { Card, PageHeader } from "@/components/ui";
import { isUsableBatch } from "@/lib/format";

export default function Page() {
  const { me } = useWorkspace();
  const inv = useInventory(me.address);
  const rows = inv.data ?? [];
  const ok = rows.filter(isUsableBatch);
  const blocked = rows.filter((b) => !ok.includes(b));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Shelf" n={3} title="Stock on the shelf" subtitle="Return stock to a distributor. Recalled or expired stock goes back to its manufacturer." />
      <Card title="Sellable"><InventoryTable me={me.address} myRole={4} rows={ok} loading={inv.isLoading} /></Card>
      {blocked.some((b) => b.balance > 0) && (
        <Card title="Do not sell: recalled, on hold or expired" className="border-danger/30"><InventoryTable me={me.address} myRole={4} rows={blocked} loading={false} /></Card>
      )}
    </div>
  );
}
