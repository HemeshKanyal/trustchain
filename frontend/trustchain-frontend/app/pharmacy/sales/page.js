"use client";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { useAuthedApi } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { dateTime, short, ZERO } from "@/lib/format";
import { CountUp } from "@/components/fx/motion";
import { Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function Sales() {
  const { me } = useWorkspace();
  const q = useAuthedApi(`/api/orgs/${me.address}/sales`, me.address, { refetchInterval: 15000 });
  const rows = q.data ?? [];
  const today = rows.filter((r) => new Date(r.timestamp * 1000).toDateString() === new Date().toDateString()).length;
  const withRx = rows.filter((r) => Number(r.prescriptionId)).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" n={4} title="What you dispensed" subtitle="Only you and the regulator can see this list." />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[["Today", today], ["All time", rows.length], ["Against prescriptions", withRx]].map(([l, v]) => (
          <div key={l} className="card px-5 py-4">
            <div className="text-xs text-slate-400">{l}</div>
            <div className="mt-1 text-3xl font-semibold text-white"><CountUp value={v} /></div>
          </div>
        ))}
      </div>
      <Card>
        {q.isLoading ? <Spinner /> : !rows.length ? <Empty icon={ReceiptText} title="No sales yet" /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th className="pl-5">When</th><th>Batch</th><th>Strip</th><th>Prescription</th><th className="pr-5">Patient</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.codeHash}>
                    <td className="pl-5 text-xs text-slate-300">{dateTime(r.timestamp)}</td>
                    <td><Link className="text-brand hover:underline" href={`/batch/${r.batchId}`}>#{r.batchId}</Link></td>
                    <td><Link className="font-mono text-xs text-slate-400 hover:text-white" href={`/verify?h=${r.codeHash}`}>{r.codeHash.slice(0, 12)}…</Link></td>
                    <td>{Number(r.prescriptionId) ? `#${r.prescriptionId}` : <span className="text-slate-500">OTC</span>}</td>
                    <td className="pr-5 font-mono text-xs">{r.patient && r.patient !== ZERO ? short(r.patient) : <span className="text-slate-500">anonymous</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
