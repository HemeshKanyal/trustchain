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
      <PageHeader eyebrow="Warehouse" n={3} title="Stock on hand" subtitle="Ship to pharmacies or other distributors. Blocked stock can only go back to its manufacturer." />
      <Card title="Ready to ship"><InventoryTable me={me.address} myRole={3} rows={ok} loading={inv.isLoading} /></Card>
      {blocked.some((b) => b.balance > 0) && (
        <Card title="Blocked: recalled, on hold or expired" className="border-danger/30"><InventoryTable me={me.address} myRole={3} rows={blocked} loading={false} /></Card>
      )}
    </div>
  );
}
