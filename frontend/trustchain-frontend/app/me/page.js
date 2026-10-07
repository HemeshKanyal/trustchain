"use client";
import Link from "next/link";
import { AlertOctagon, Pill } from "lucide-react";
import { useAuthedApi, useNames, useVerify } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { useNebula } from "@/components/fx/Nebula";
import { VERDICTS, dateTime, short } from "@/lib/format";
import { Badge, Empty, Notice, PageHeader, Spinner, cx } from "@/components/ui";
import { Reveal } from "@/components/fx/motion";

export default function Cabinet() {
  const { me } = useWorkspace();
  const strips = useAuthedApi(`/api/patients/${me.address}/strips`, me.address, { refetchInterval: 15000 });
  const alerts = useAuthedApi("/api/alerts?limit=200", me.address, { refetchInterval: 15000 });
  const recalls = (alerts.data ?? []).filter((a) => a.type === "recall" && a.details?.affected?.affectsViewer);
  const name = useNames();
  useNebula(recalls.length ? "rose" : "teal");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My cabinet" n={1} title="My medicines" subtitle={<>Everything dispensed to <span className="font-mono">{short(me.address)}</span>, with its live status.</>} />
      {recalls.map((a) => (
        <Notice key={a.id} tone="danger" icon={AlertOctagon} title="A medicine you received has been recalled">
          Batch #{a.batchId}: {a.details.reason}. Stop taking it and return it to your pharmacy.{" "}
          <Link className="text-white underline" href={`/batch/${a.batchId}`}>Details</Link>
        </Notice>
      ))}
      {strips.isLoading ? <Spinner /> : !strips.data?.length ? (
        <div className="card"><Empty icon={Pill} title="Nothing yet">When a pharmacy dispenses strips to your wallet, they appear here.</Empty></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strips.data.map((s, i) => (
            <Reveal key={s.codeHash} delay={Math.min(i, 6) * 0.04}>
              <StripCard s={s} pharmacy={name(s.pharmacy) ?? short(s.pharmacy)} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function StripCard({ s, pharmacy }) {
  const { data: v } = useVerify(s.codeHash);
  const verdict = v ? VERDICTS[Number(v.verdict)] : null;
  const bad = v && [3, 4, 5].includes(Number(v.verdict));
  return (
    <Link href={`/batch/${s.batchId}`} className={cx("card card-hover block p-5", bad && "border-danger/40 bg-danger/[0.06]")} data-testid="patient-strip">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-white">{v?.productName ?? "…"}</div>
        {verdict && <Badge tone={bad ? "danger" : "ok"}>{bad ? verdict.label : "Good standing"}</Badge>}
      </div>
      <div className="mt-2 text-xs text-slate-400">{pharmacy} · {dateTime(s.timestamp)}</div>
      <div className="mt-1 text-xs text-slate-500">{v?.manufacturerName} · lot {v?.lotNumber}{Number(s.prescriptionId) ? ` · Rx #${s.prescriptionId}` : ""}</div>
    </Link>
  );
}
