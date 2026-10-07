"use client";
import { ClipboardList } from "lucide-react";
import { useNames, usePrescriptionsOf } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { rxStatus } from "@/components/status";
import RxCard from "@/components/rx/RxCard";
import RxText from "@/components/rx/RxText";
import { date, short } from "@/lib/format";
import { Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function MyPrescriptions() {
  const { me } = useWorkspace();
  const rx = usePrescriptionsOf(me.address, "patient");
  const name = useNames();
  const rows = rx.data ?? [];
  const active = rows.filter((p) => p.usable);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Prescriptions" n={2} title="My prescriptions" subtitle="Show the QR at the pharmacy." />
      {rx.isLoading ? <Spinner /> : !rows.length ? <div className="card"><Empty icon={ClipboardList} title="No prescriptions" /></div> : (
        <>
          {active.map((p) => (
            <RxCard key={p.id} id={p.id} doctorName={name(p.doctor) ?? short(p.doctor)} patient={p.patient} allowance={p.allowance - p.dispensed} validUntil={p.validUntil} text={undefined} print={false} />
          ))}
          <Card title="History">
            <ul className="divide-y divide-white/[0.06] text-sm">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-white">Rx #{p.id} · <RxText id={p.id} viewer={me.address} className="font-normal text-slate-300" /></div>
                    <div className="text-xs text-slate-400">{name(p.doctor) ?? short(p.doctor)} · {p.dispensed}/{p.allowance} strips · until {date(p.validUntil)}</div>
                  </div>
                  {rxStatus(p)}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
