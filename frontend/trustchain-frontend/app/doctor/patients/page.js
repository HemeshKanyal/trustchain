"use client";
import Link from "next/link";
import { Users } from "lucide-react";
import { usePrescriptionsOf } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { date, short } from "@/lib/format";
import { Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function Patients() {
  const { me } = useWorkspace();
  const list = usePrescriptionsOf(me.address, "doctor");
  const by = {};
  for (const p of list.data ?? []) (by[p.patient] ??= []).push(p);
  const patients = Object.entries(by);
  return (
    <>
      <PageHeader eyebrow="Patients" n={3} title="People you prescribed for" subtitle="Only prescriptions you issued are shown." />
      {list.isLoading ? <Spinner /> : !patients.length ? <div className="card"><Empty icon={Users} title="No patients yet" /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {patients.map(([addr, rx]) => (
            <Card key={addr} title={<span className="font-mono">{short(addr)}</span>} subtitle={`${rx.length} prescription${rx.length > 1 ? "s" : ""} · last ${date(rx[0].issuedAt)}`} actions={<Link href="/doctor"><Button size="sm" variant="secondary">New prescription</Button></Link>}>
              <ul className="space-y-1 text-sm text-slate-300">
                {rx.map((p) => <li key={p.id}>Rx #{p.id} · {p.dispensed}/{p.allowance} strips</li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
