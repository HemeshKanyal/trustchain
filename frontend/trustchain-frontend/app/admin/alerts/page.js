"use client";
import { Download } from "lucide-react";
import { useAuthedApi } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import AlertsFeed from "@/components/AlertsFeed";
import Link from "next/link";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";

export default function Page() {
  const { me } = useWorkspace();
  const all = useAuthedApi("/api/alerts?limit=500", me.address);
  const reports = useAuthedApi("/api/reports", me.address, { refetchInterval: 20000 });
  function exportCsv() {
    const rows = [["alert_id", "type", "batch", "shipment", "date", "kind", "who", "strips"]];
    for (const a of all.data ?? []) {
      const af = a.details?.affected;
      if (!af) continue;
      const when = new Date(a.createdAt * 1000).toISOString();
      for (const h of af.holders ?? []) rows.push([a.id, a.type, a.batchId, a.shipmentId ?? "", when, "holder", `${h.name} ${h.address}`, h.balance]);
      for (const p of af.patients ?? []) rows.push([a.id, a.type, a.batchId, a.shipmentId ?? "", when, "patient", p, ""]);
    }
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "trustchain-affected.csv" }).click();
  }
  return (
    <>
      <PageHeader
        eyebrow="Recalls & alerts"
        n={5}
        title="Who is affected"
        subtitle="Each alert lists the pharmacies holding stock, shipments on the road and the patients who received strips."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={!all.data}><Download className="h-4 w-4" /> Export affected (CSV)</Button>}
      />
      <div className="space-y-6">
        <Card>
          <AlertsFeed limit={100} authAddress={me.address} showPatients />
        </Card>
        <Card title="Reports from the public" subtitle="Sent from the Verify page when a strip did not check out.">
          {!reports.data?.length ? <Empty title="No reports" /> : (
            <ul className="space-y-2 text-sm" data-testid="public-reports">
              {reports.data.map((r) => (
                <li key={r.id} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-white">{r.verdict}</span>
                    <span className="text-xs text-slate-500">{dateTime(r.created_at)}</span>
                  </div>
                  <div className="mt-1 text-slate-300">{r.where_bought || "Place not given"}{r.note ? ` · ${r.note}` : ""}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    <Link className="hover:text-brand" href={`/verify?h=${r.code_hash}`}>code {r.code_hash.slice(0, 12)}…</Link>
                    {r.contact && ` · contact: ${r.contact}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
