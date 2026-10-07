"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, CheckCircle2, Clock, Flag, PauseCircle, ShieldAlert, XCircle } from "lucide-react";
import { useApi, useNames, useVerify } from "@/lib/hooks";
import { useNebula } from "./fx/Nebula";
import SmartBox from "./fx/SmartBox";
import { Reveal } from "./fx/motion";
import { API_URL } from "@/lib/config";
import { VERDICTS, date, dateTime } from "@/lib/format";
import { Address, Button, Field, Input, Notice, Textarea, cx } from "./ui";
import RiskPanel from "./ai/RiskPanel";
import { visitorId } from "@/lib/visitor";

const ICON = { genuine: CheckCircle2, unknown: XCircle, dispensed: Clock, recalled: AlertOctagon, quarantined: PauseCircle, expired: ShieldAlert };
const WORD = { genuine: "GENUINE", unknown: "NOT RECOGNISED", dispensed: "ALREADY SOLD", recalled: "RECALLED", quarantined: "ON HOLD", expired: "EXPIRED" };
const COLOR = { ok: "text-emerald-300", warn: "text-amber-300", danger: "text-rose-400" };
const NEBULA = { ok: "teal", warn: "amber", danger: "rose" };

export default function VerifyResult({ codeHash }) {
  const { data: v, isLoading, error } = useVerify(codeHash);
  const verdict = v ? VERDICTS[Number(v.verdict)] : null;
  useNebula(verdict ? NEBULA[verdict.tone] : "teal");
  // Anonymous scan log: lets the AI spot copied codes (one sold code scanned by many different people).
  const key = verdict?.key;
  useEffect(() => {
    if (!key) return;
    fetch(`${API_URL}/api/scans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeHash, verdict: key, visitor: visitorId() }) }).catch(() => {});
  }, [codeHash, key]);

  if (isLoading)
    return (
      <div className="flex flex-col items-center py-6">
        <SmartBox state="checking" size={220} />
        <p className="mt-2 text-sm text-slate-400">Reading the blockchain…</p>
      </div>
    );
  if (error) return <Notice tone="danger">Could not reach the blockchain: {error.shortMessage ?? error.message}</Notice>;
  if (!v) return null;
  const Icon = ICON[verdict.key];
  const known = Number(v.verdict) !== 0;

  return (
    <div className="space-y-6" data-testid="verify-result" data-verdict={verdict.key}>
      <Reveal className="text-center">
        <Icon className={cx("mx-auto h-14 w-14", COLOR[verdict.tone])} />
        <div className={cx("display mt-4 text-5xl sm:text-7xl", COLOR[verdict.tone])}>{WORD[verdict.key]}</div>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg">{verdict.advice}</p>
      </Reveal>

      {known && (
        <Reveal delay={0.1}>
          <MiniJourney v={v} />
        </Reveal>
      )}

      {known && (
        <Reveal delay={0.12}>
          <RiskPanel batchId={Number(v.batchId)} compact />
        </Reveal>
      )}

      {known && (
        <Reveal delay={0.15} className="card grid gap-x-6 gap-y-4 p-6 text-sm sm:grid-cols-3">
          <Row label="Medicine">{v.productName}</Row>
          <Row label="Lot / batch">{v.lotNumber} · #{Number(v.batchId)}</Row>
          <Row label="Manufacturer"><Address address={v.manufacturer} name={v.manufacturerName} /></Row>
          <Row label="Manufactured">{date(v.manufacturedAt)}</Row>
          <Row label="Expires">{date(v.expiresAt)}</Row>
          {Number(v.dispensedAt) > 0 && <Row label="Sold">{dateTime(v.dispensedAt)} by {v.dispensedByName}</Row>}
        </Reveal>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {known && (
          <Link href={`/batch/${Number(v.batchId)}`}>
            <Button variant="secondary">See its full journey</Button>
          </Link>
        )}
      </div>
      {verdict.tone !== "ok" && <ReportForm codeHash={codeHash} verdict={verdict.key} batchId={known ? Number(v.batchId) : null} />}
    </div>
  );
}

function MiniJourney({ v }) {
  const timeline = useApi(`/api/batches/${Number(v.batchId)}/timeline`);
  const name = useNames();
  const events = timeline.data ?? [];
  const moves = events.filter((e) => e.name === "ShipmentDelivered");
  const lastHop = moves.at(-1);
  const sold = Number(v.dispensedAt) > 0;
  const steps = [
    { label: "Made", who: v.manufacturerName, when: date(v.manufacturedAt), on: true },
    { label: "Moved", who: lastHop ? `${moves.length} handover${moves.length > 1 ? "s" : ""}, last ${name(lastHop.args.to) ?? "a pharmacy"}` : "No handovers yet", when: lastHop ? date(lastHop.timestamp) : "", on: moves.length > 0 },
    { label: "Sold", who: sold ? v.dispensedByName : "Not sold yet", when: sold ? date(v.dispensedAt) : "", on: sold },
    { label: "You", who: "Scanning now", when: "", on: true },
  ];
  return (
    <div className="card p-6">
      <ol className="grid gap-6 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className="relative">
            {i < 3 && <span className={cx("absolute left-5 top-5 hidden h-px w-[calc(100%+1.5rem)] sm:block", s.on && steps[i + 1].on ? "bg-brand/60" : "bg-white/10")} />}
            <span className={cx("relative grid h-10 w-10 place-items-center rounded-full ring-1", s.on ? "bg-brand/15 text-brand ring-brand/40" : "bg-white/5 text-slate-500 ring-white/10")}>
              {i + 1}
            </span>
            <div className="mt-3 text-sm font-semibold text-white">{s.label}</div>
            <div className="text-xs text-slate-400">{s.who}</div>
            {s.when && <div className="text-xs text-slate-500">{s.when}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReportForm({ codeHash, verdict, batchId }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ whereBought: "", note: "", contact: "", price: "" });
  const [state, setState] = useState(null);
  if (state === "sent") return <Notice tone="ok" className="mx-auto max-w-xl">Thank you. The regulator has your report.</Notice>;
  return (
    <div className="mx-auto max-w-xl">
      {!open ? (
        <div className="text-center">
          <Button variant="danger" onClick={() => setOpen(true)} data-testid="report-open"><Flag className="h-4 w-4" /> Report this medicine</Button>
        </div>
      ) : (
        <form
          className="card space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("sending");
            const r = await fetch(`${API_URL}/api/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeHash, verdict, batchId, ...f, price: f.price ? Number(f.price) : undefined }) });
            setState(r.ok ? "sent" : "error");
          }}
        >
          <div className="font-semibold text-white">Report to the regulator</div>
          <Field label="Where did you get it?"><Input value={f.whereBought} onChange={(e) => setF({ ...f, whereBought: e.target.value })} placeholder="Shop name and city" /></Field>
          <Field label="Price you paid per strip (₹, optional)" hint="Prices far below market are a common sign of fake medicine.">
            <Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} data-testid="report-price" />
          </Field>
          <Field label="Anything else?"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <Field label="Contact (optional)" hint="Phone or email, only if you want to be contacted."><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
          {state === "error" && <p className="text-sm text-rose-300">Could not send. Try again in a moment.</p>}
          <Button type="submit" variant="danger" loading={state === "sending"} className="w-full" data-testid="report-send">Send report</Button>
        </form>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-slate-100">{children}</div>
    </div>
  );
}
