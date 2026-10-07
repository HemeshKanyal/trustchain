"use client";
import { useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { date, isExpired } from "@/lib/format";
import { BatchStatus } from "./status";
import ShipModal from "./ShipModal";
import { Button, Empty, Spinner } from "./ui";

export default function InventoryTable({ me, myRole, rows, loading, showEmpty = false, extraActions }) {
  const [shipping, setShipping] = useState(null);
  if (loading) return <Spinner />;
  const list = (rows ?? []).filter((r) => showEmpty || r.balance > 0);
  if (!list.length) return <Empty icon={Package} title="No stock">Incoming shipments appear here once you confirm receipt.</Empty>;

  return (
    <>
      <div className="-mx-5 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="pl-5">Batch</th>
              <th>Medicine</th>
              <th>Expires</th>
              <th>Status</th>
              <th>In stock</th>
              <th className="pr-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => {
              const blocked = b.status !== 0 || isExpired(b.expiresAt);
              return (
                <tr key={b.id} data-testid={`batch-row-${b.id}`}>
                  <td className="pl-5">
                    <Link href={`/batch/${b.id}`} className="font-medium text-white hover:text-brand">
                      #{b.id}
                    </Link>
                    <div className="text-xs text-slate-500">{b.lotNumber}</div>
                  </td>
                  <td>
                    {b.productName}
                    {b.rxOnly && <span className="ml-2 text-xs text-blue-300">Rx</span>}
                  </td>
                  <td className="text-slate-300">{date(b.expiresAt)}</td>
                  <td>
                    <BatchStatus batch={b} />
                  </td>
                  <td className="tabular-nums">
                    {b.balance}
                    {b.mine && <span className="text-slate-500"> / {b.quantity}</span>}
                  </td>
                  <td className="pr-5">
                    <div className="flex justify-end gap-2">
                      {extraActions?.(b)}
                      {b.balance > 0 && !(blocked && myRole === 2) && (
                        <Button size="sm" variant={blocked ? "danger" : "secondary"} onClick={() => setShipping(b)} data-testid={`ship-batch-${b.id}`}>
                          {blocked ? "Return" : "Ship"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShipModal key={shipping?.id ?? "none"} open={Boolean(shipping)} onClose={() => setShipping(null)} me={me} myRole={myRole} batch={shipping} balance={shipping?.balance ?? 0} />
    </>
  );
}
