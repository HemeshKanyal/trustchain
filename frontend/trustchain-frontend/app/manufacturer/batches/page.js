"use client";
import { useState } from "react";
import Link from "next/link";
import { Boxes, PlusCircle, Printer, QrCode } from "lucide-react";
import { useInventory } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { useSerialise } from "@/components/work/serialise";
import Distribution from "@/components/work/Distribution";
import RecallModal from "@/components/work/RecallModal";
import ShipModal from "@/components/ShipModal";
import { BatchStatus } from "@/components/status";
import { date, daysUntil, isExpired, pct, temp } from "@/lib/format";
import { Badge, Button, Empty, PageHeader, Spinner } from "@/components/ui";
import { Reveal } from "@/components/fx/motion";

export default function Batches() {
  const { me } = useWorkspace();
  const inv = useInventory(me.address);
  const { serialise, progress } = useSerialise();
  const [shipping, setShipping] = useState(null);
  const [recalling, setRecalling] = useState(null);
  const mine = (inv.data ?? []).filter((b) => b.mine);
  return (
    <>
      <PageHeader eyebrow="Batches" n={2} title="Your batches" actions={<Link href="/manufacturer/batches/new"><Button><PlusCircle className="h-4 w-4" /> New batch</Button></Link>} />
      {inv.isLoading ? (
        <Spinner />
      ) : !mine.length ? (
        <div className="card"><Empty icon={Boxes} title="No batches yet">Create your first batch and print its strip labels.</Empty></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mine.map((b, i) => {
            const days = daysUntil(b.expiresAt);
            return (
              <Reveal key={b.id} delay={Math.min(i, 6) * 0.04}>
                <div className="card p-5" data-testid={`batch-card-${b.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/manufacturer/batches/${b.id}`} className="text-lg font-semibold text-white hover:text-brand">{b.productName}</Link>
                      <div className="mt-0.5 text-xs text-slate-400">
                        #{b.id} · lot <span data-testid="batch-lot">{b.lotNumber}</span> · {b.rxOnly ? "Rx only" : "OTC"} · {temp(b.conditions.minTempX10)}–{temp(b.conditions.maxTempX10)}
                        {Number(b.conditions.maxHumidityX10) ? `, ≤${pct(b.conditions.maxHumidityX10)}` : ""}
                      </div>
                    </div>
                    <BatchStatus batch={b} />
                  </div>
                  <div className="mt-4"><Distribution batch={b} /></div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      {b.stripsRegistered}/{b.quantity} serialised · {isExpired(b.expiresAt) ? "expired" : `expires ${date(b.expiresAt)} (${days} d)`} · <b className="text-slate-200" data-testid="batch-stock">{b.balance}</b> in stock
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {b.stripsRegistered < b.quantity && b.status !== 2 && (
                        <Button size="sm" variant="secondary" loading={progress?.batchId === b.id} onClick={() => serialise(b)}>
                          <QrCode className="h-3.5 w-3.5" /> Serialise {b.quantity - b.stripsRegistered}
                        </Button>
                      )}
                      <Link href={`/manufacturer/batches/${b.id}/labels`}><Button size="sm" variant="ghost"><Printer className="h-3.5 w-3.5" /> Labels</Button></Link>
                      {b.balance > 0 && b.status === 0 && !isExpired(b.expiresAt) && (
                        <Button size="sm" onClick={() => setShipping(b)} data-testid={`ship-batch-${b.id}`}>Ship</Button>
                      )}
                      {b.status !== 2 && <Button size="sm" variant="danger" onClick={() => setRecalling(b)} data-testid={`recall-${b.id}`}>Recall</Button>}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
      {mine.some((b) => b.status === 2) && <p className="mt-4 text-xs text-slate-500"><Badge tone="danger">Recalled</Badge> batches can only receive returns.</p>}
      <ShipModal key={shipping?.id ?? "none"} open={Boolean(shipping)} onClose={() => setShipping(null)} me={me.address} myRole={2} batch={shipping} balance={shipping?.balance ?? 0} />
      <RecallModal key={recalling?.id ?? "r"} batch={recalling} onClose={() => setRecalling(null)} />
    </>
  );
}
