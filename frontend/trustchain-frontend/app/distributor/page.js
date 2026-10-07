"use client";
import { useState } from "react";
import Link from "next/link";
import { useInventory, useShipmentsOf } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import ShipmentCard from "@/components/work/ShipmentCard";
import ReceiveDialog from "@/components/work/ReceiveDialog";
import { BatchStatus } from "@/components/status";
import { Button, PageHeader } from "@/components/ui";

function Column({ title, count, children }) {
  return (
    <div className="card flex min-h-64 flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">{title}</div>
        <span className="rounded-full bg-white/5 px-2 text-xs text-slate-300">{count}</span>
      </div>
      <div className="flex-1 space-y-3">{children}</div>
    </div>
  );
}

export default function Board() {
  const { me } = useWorkspace();
  const ships = useShipmentsOf(me.address);
  const inv = useInventory(me.address);
  const [receiving, setReceiving] = useState(null);
  const mine = (s) => s.to.toLowerCase() === me.address.toLowerCase();
  const arriving = (ships.data ?? []).filter((s) => mine(s) && s.status === 1);
  const road = (ships.data ?? []).filter((s) => !mine(s) && s.status === 1);
  const stock = (inv.data ?? []).filter((b) => b.balance > 0);
  return (
    <>
      <PageHeader eyebrow="Board" n={1} title={me.participant.name} subtitle={`Distributor · ${me.participant.location || "—"}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Arriving" count={arriving.length}>
          {arriving.map((s) => <ShipmentCard key={s.id} s={s} me={me.address} action={<Button size="sm" onClick={() => setReceiving(s)} data-testid={`receive-${s.id}`}>Receive</Button>} />)}
          {!arriving.length && <p className="text-sm text-slate-500">Nothing on its way to you.</p>}
        </Column>
        <Column title="In warehouse" count={stock.reduce((a, b) => a + b.balance, 0)}>
          {stock.map((b) => (
            <Link key={b.id} href="/distributor/inventory" className="block rounded-xl border border-white/[0.08] bg-black/20 p-4 hover:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-white">{b.productName}</span>
                <BatchStatus batch={b} />
              </div>
              <div className="mt-1 text-xs text-slate-400">batch #{b.id} · <b className="text-slate-200">{b.balance}</b> strips</div>
            </Link>
          ))}
          {!stock.length && <p className="text-sm text-slate-500">Empty.</p>}
        </Column>
        <Column title="On the road" count={road.length}>
          {road.map((s) => <ShipmentCard key={s.id} s={s} me={me.address} />)}
          {!road.length && <p className="text-sm text-slate-500">No outgoing shipments.</p>}
        </Column>
      </div>
      {receiving && <ReceiveDialog shipment={receiving} onClose={() => setReceiving(null)} />}
    </>
  );
}
