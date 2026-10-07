"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { CheckCircle2, Printer, ShoppingBasket, Trash2 } from "lucide-react";
import { useAuthedApi, useBatch, useNames, usePrescription, useVerify } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { useWorkspace } from "@/components/Workspace";
import { authedFetch } from "@/lib/session";
import { trustChain } from "@/lib/config";
import { codeHashOf, parseRx, parseStripCode, parseWalletQr } from "@/lib/qr";
import { VERDICTS, date, short, ZERO } from "@/lib/format";
import QrScanner from "@/components/QrScanner";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, cx } from "@/components/ui";

export default function Counter() {
  const { me } = useWorkspace();
  const { send, pending } = useTx();
  const [strips, setStrips] = useState([]);
  const [verdicts, setVerdicts] = useState({});
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [rxInput, setRxInput] = useState("");
  const [patient, setPatient] = useState("");
  const [price, setPrice] = useState("");
  const [batchOf, setBatchOf] = useState({});
  const [receipt, setReceipt] = useState(null);
  const rxId = parseRx(rxInput);
  const rx = usePrescription(rxId);
  const details = useAuthedApi(rxId ? `/api/prescriptions/${rxId}/details` : null, me.address);
  const name = useNames();

  function add(text) {
    const secret = parseStripCode(text);
    if (!secret) return setErr("Not a TrustChain strip code.");
    if (strips.includes(secret)) return setErr("Already in the basket.");
    setErr(null);
    setCode("");
    setStrips((s) => [...s, secret]);
  }

  const r = rx.data;
  const rxProblem = rxId && r ? (r.doctor === ZERO ? "Prescription not found." : !r.usable ? "This prescription is cancelled, expired or fully used." : patient && r.patient.toLowerCase() !== patient.toLowerCase() ? "This prescription is for a different patient." : r.allowance - r.dispensed < strips.length ? `Only ${r.allowance - r.dispensed} strip(s) left on this prescription.` : null) : null;
  const bad = strips.filter((s) => verdicts[s] && verdicts[s] !== 1);
  const needsRx = strips.some((s) => verdicts[`rx:${s}`]) && !rxId;
  const blocker = bad.length ? `${bad.length} strip(s) in the basket can't be sold (see red badges).` : needsRx ? "Prescription-only medicine in the basket: enter the patient's prescription." : rxProblem;

  async function dispense() {
    const ok = await send({
      contract: trustChain,
      functionName: "dispense",
      args: [strips, patient || ZERO, BigInt(rxId ?? 0)],
      label: `Dispense ${strips.length} strip${strips.length > 1 ? "s" : ""}`,
      success: "Dispensed. These strips are now marked as sold.",
    });
    if (ok) {
      if (Number(price) > 0) {
        for (const b of new Set(strips.map((s) => batchOf[s]).filter(Boolean))) {
          authedFetch("/api/prices", me.address, { method: "POST", body: JSON.stringify({ batchId: b, price: Number(price) }) }).catch(() => {});
        }
      }
      setPrice("");
      setReceipt({ strips, patient, rxId, at: Date.now(), tx: ok.receipt.transactionHash });
      setStrips([]);
      setVerdicts({});
      setRxInput("");
      setPatient("");
    }
  }

  if (receipt) return <Receipt receipt={receipt} pharmacy={me.participant} onNew={() => setReceipt(null)} />;

  return (
    <>
      <PageHeader eyebrow="Counter" n={1} title={me.participant.name} subtitle="Scan each strip you hand over. Bad strips turn red before anything is signed." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Basket" subtitle={`${strips.length} strip${strips.length === 1 ? "" : "s"}`} className="lg:col-span-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(code); }}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TC1:0x…" className="font-mono" aria-label="Strip code" data-testid="dispense-code" />
            <Button type="submit" variant="secondary" data-testid="dispense-add">Add</Button>
            <QrScanner onResult={add} label="Scan" variant="primary" />
          </form>
          {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
          <ul className="mt-4 space-y-2">
            {strips.map((s) => (
              <StripLine key={s} secret={s} onVerdict={(v, rxOnly, batchId) => {
                setVerdicts((x) => (x[s] === v && x[`rx:${s}`] === rxOnly ? x : { ...x, [s]: v, [`rx:${s}`]: rxOnly }));
                if (batchId) setBatchOf((x) => (x[s] === batchId ? x : { ...x, [s]: batchId }));
              }} onRemove={() => setStrips((x) => x.filter((y) => y !== s))} />
            ))}
            {!strips.length && (
              <li className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500">
                <ShoppingBasket className="h-8 w-8 text-slate-600" /> Scan the first strip.
              </li>
            )}
          </ul>
        </Card>

        <Card title="Prescription & patient" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="Prescription" hint="Scan the QR on the patient's prescription, or type its number.">
              <div className="flex gap-2">
                <Input value={rxInput} onChange={(e) => setRxInput(e.target.value)} placeholder="TCRX:12 or 12" data-testid="dispense-rx" />
                <QrScanner onResult={(t) => setRxInput(t)} label="Scan" size="sm" />
              </div>
            </Field>
            {r && r.doctor !== ZERO && (
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-sm" data-testid="rx-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">Rx #{r.id}</span>
                  {r.usable ? <Badge tone="ok">Valid</Badge> : <Badge tone="danger">Not usable</Badge>}
                </div>
                {details.data?.text && <p className="mt-2 whitespace-pre-wrap text-slate-200" data-testid="rx-details">{details.data.text}</p>}
                <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                  <div>Doctor: {name(r.doctor) ?? short(r.doctor)}</div>
                  <div>Patient: {short(r.patient)}</div>
                  <div>{r.dispensed} of {r.allowance} strips dispensed · valid until {date(r.validUntil)}</div>
                </div>
                {r.usable && patient.toLowerCase() !== r.patient.toLowerCase() && (
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => setPatient(r.patient)}>Use this patient</Button>
                )}
              </div>
            )}
            <Field label="Patient wallet" hint="Optional for over-the-counter sales; lets the patient get recall alerts.">
              <div className="flex gap-2">
                <Input value={patient} onChange={(e) => setPatient(e.target.value.trim())} placeholder="0x…" className="font-mono" data-testid="dispense-patient" />
                <QrScanner onResult={(t) => setPatient(parseWalletQr(t) ?? "")} label="Scan" size="sm" />
              </div>
            </Field>
            <Field label="Price per strip (₹, optional)" hint="Feeds TrustChain AI's market-price check. Never shown publicly.">
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} data-testid="dispense-price" />
            </Field>
            {strips.length > 0 && blocker && <Notice tone="danger" className="text-sm">{blocker}</Notice>}
            <Button className="w-full" size="lg" disabled={!strips.length || Boolean(blocker) || (patient && !isAddress(patient))} loading={pending === "dispense"} onClick={dispense} data-testid="dispense-submit">
              Dispense {strips.length || ""} strip{strips.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

function StripLine({ secret, onRemove, onVerdict }) {
  const { data: v } = useVerify(codeHashOf(secret));
  const known = v && Number(v.verdict) !== 0;
  const { data: batch } = useBatch(known ? Number(v.batchId) : null);
  const verdict = v ? VERDICTS[Number(v.verdict)] : null;
  const report = useRef(onVerdict);
  useEffect(() => {
    report.current = onVerdict;
  });
  const n = v ? Number(v.verdict) : null;
  const rxOnly = Boolean(batch?.rxOnly);
  useEffect(() => {
    if (n != null) report.current(n, rxOnly, v && Number(v.verdict) !== 0 ? Number(v.batchId) : null);
  }, [n, rxOnly, v]);
  return (
    <li className={cx("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5", verdict && Number(v.verdict) !== 1 ? "border-danger/40 bg-danger/[0.06]" : "border-white/[0.07] bg-black/20")} data-testid="dispense-strip">
      <div className="min-w-0">
        <div className="truncate text-sm text-slate-100">{v ? (Number(v.verdict) === 0 ? "Unknown code" : `${v.productName} · lot ${v.lotNumber}`) : "Checking…"}</div>
        <div className="font-mono text-xs text-slate-500">{secret.slice(0, 18)}…</div>
      </div>
      <div className="flex items-center gap-2">
        {rxOnly && <Badge tone="info">Rx</Badge>}
        {verdict && <Badge tone={verdict.tone}>{verdict.label}</Badge>}
        <button type="button" onClick={onRemove} aria-label="Remove strip" className="text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

function Receipt({ receipt, pharmacy, onNew }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-6" data-testid="receipt">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-brand" />
          <div>
            <div className="text-lg font-semibold text-white">Dispensed</div>
            <div className="text-xs text-slate-400">{pharmacy.name} · {new Date(receipt.at).toLocaleString()}</div>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-white/[0.06] text-sm">
          {receipt.strips.map((s, i) => (
            <li key={s} className="flex items-center justify-between py-2">
              <span className="text-slate-300">Strip {i + 1}</span>
              <Link href={`/verify?h=${codeHashOf(s)}`} className="font-mono text-xs text-brand hover:underline">check status</Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-xs text-slate-400">
          {receipt.rxId && <div>Prescription #{receipt.rxId}</div>}
          {receipt.patient && <div>Patient {short(receipt.patient)} can see these under &quot;My medicines&quot; and will be alerted on a recall.</div>}
          <div className="font-mono">tx {receipt.tx.slice(0, 20)}…</div>
        </div>
        <div className="no-print mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          <Button onClick={onNew} data-testid="new-sale">New sale</Button>
        </div>
      </div>
    </div>
  );
}
