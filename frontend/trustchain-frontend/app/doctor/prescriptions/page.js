"use client";
import { ClipboardList } from "lucide-react";
import { usePrescriptionsOf } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { useWorkspace } from "@/components/Workspace";
import { trustChain } from "@/lib/config";
import { date, short } from "@/lib/format";
import { rxStatus } from "@/components/status";
import RxText from "@/components/rx/RxText";
import { Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function Prescriptions() {
  const { me } = useWorkspace();
  const list = usePrescriptionsOf(me.address, "doctor");
  const { send } = useTx();
  const rows = list.data ?? [];
  return (
    <>
      <PageHeader eyebrow="Prescriptions" n={2} title="Issued by you" />
      <Card>
        {list.isLoading ? <Spinner /> : !rows.length ? <Empty icon={ClipboardList} title="No prescriptions yet" /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th className="pl-5">Rx</th><th>Patient</th><th>Medicine</th><th>Strips</th><th>Status</th><th className="pr-5" /></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="pl-5 font-medium text-white">#{p.id}<div className="text-xs font-normal text-slate-500">until {date(p.validUntil)}</div></td>
                    <td className="font-mono text-xs">{short(p.patient)}</td>
                    <td className="max-w-72"><RxText id={p.id} viewer={me.address} className="line-clamp-2 text-slate-300" /></td>
                    <td className="tabular-nums">{p.dispensed} / {p.allowance}</td>
                    <td>{rxStatus(p)}</td>
                    <td className="pr-5 text-right">
                      {!p.cancelled && p.usable && (
                        <Button size="sm" variant="ghost" onClick={() => send({ contract: trustChain, functionName: "cancelPrescription", args: [BigInt(p.id)], label: `Cancel Rx #${p.id}` })}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
