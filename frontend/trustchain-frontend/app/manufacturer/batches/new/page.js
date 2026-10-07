"use client";
import { useState } from "react";
import Link from "next/link";
import { keccak256, stringToHex } from "viem";
import { CheckCircle2, Printer } from "lucide-react";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { useSerialise, CHUNK } from "@/components/work/serialise";
import SmartBox from "@/components/fx/SmartBox";
import { Button, Field, Input, Notice, PageHeader, Textarea, cx } from "@/components/ui";

const STEPS = ["Product", "Lot & quantity", "Storage rules", "Certificate", "Review & sign", "Strip codes"];

export default function NewBatch() {
  const { send } = useTx();
  const { serialise, progress } = useSerialise();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    productName: "",
    lotNumber: `TC-IN-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`,
    quantity: 50,
    expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    min: 2,
    max: 8,
    hum: 70,
    rxOnly: true,
    notes: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const txs = 1 + Math.ceil(Number(f.quantity || 0) / CHUNK);

  async function create() {
    setBusy(true);
    try {
      const expiresAt = BigInt(Math.floor(new Date(`${f.expiry}T23:59:59`).getTime() / 1000));
      const res = await send({
        contract: trustChain,
        functionName: "createBatch",
        args: [
          f.productName.trim(),
          f.lotNumber.trim(),
          Number(f.quantity),
          expiresAt,
          f.rxOnly,
          { minTempX10: Math.round(Number(f.min) * 10), maxTempX10: Math.round(Number(f.max) * 10), maxHumidityX10: Math.round(Number(f.hum || 0) * 10) },
          keccak256(stringToHex(f.notes || f.productName)),
        ],
        label: `Create batch ${f.lotNumber}`,
        success: "Batch created on-chain",
      });
      if (!res) return;
      const id = Number(res.result);
      setCreated(id);
      setStep(5);
      await serialise({ id, quantity: Number(f.quantity), stripsRegistered: 0 });
    } finally {
      setBusy(false);
    }
  }

  const done = created && !progress && step === 5;
  return (
    <div>
      <PageHeader eyebrow="New batch" n={STEPS.indexOf(STEPS[step]) + 1} title={STEPS[step]} subtitle="Every strip gets a unique secret QR code. Only its hash goes on the blockchain." />
      <ol className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STEPS.map((s, i) => (
          <li key={s} className={cx("rounded-xl border px-3 py-2 text-[11px]", i === step ? "border-brand/50 bg-brand/[0.08] text-white" : i < step ? "border-white/10 text-teal-300" : "border-white/10 text-slate-500")}>
            <span className="font-semibold tracking-[0.2em]">0{i + 1}</span>
            <span className="ml-1.5 hidden md:inline">{s}</span>
          </li>
        ))}
      </ol>

      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) setStep(step + 1);
          else if (step === 4) create();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {step === 0 && (
            <>
              <Field label="Medicine name and strength" className="sm:col-span-2">
                <Input required autoFocus value={f.productName} onChange={set("productName")} placeholder="Amoxicillin 500mg capsules" data-testid="nb-product" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                <input type="checkbox" checked={f.rxOnly} onChange={set("rxOnly")} className="h-4 w-4 accent-teal-400" data-testid="nb-rx" />
                Prescription-only: pharmacies must dispense against a doctor&apos;s prescription
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Lot number">
                <Input required value={f.lotNumber} onChange={set("lotNumber")} className="font-mono" data-testid="nb-lot" />
              </Field>
              <Field label="Number of strips" hint={`Codes are registered ${CHUNK} per transaction (${txs - 1} signature${txs - 1 === 1 ? "" : "s"} + 1 for the batch).`}>
                <Input required type="number" min={1} max={2000} value={f.quantity} onChange={set("quantity")} data-testid="nb-qty" />
              </Field>
              <Field label="Expiry date">
                <Input required type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={f.expiry} onChange={set("expiry")} data-testid="nb-expiry" />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <div className="sm:col-span-2">
                <div className="mb-2 text-xs font-medium text-slate-300">Storage temperature (°C)</div>
                <div className="flex items-center gap-3">
                  <Input required type="number" step="0.1" value={f.min} onChange={set("min")} aria-label="Minimum temperature" data-testid="nb-min" />
                  <span className="text-slate-500">to</span>
                  <Input required type="number" step="0.1" value={f.max} onChange={set("max")} aria-label="Maximum temperature" data-testid="nb-max" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[["Cold chain 2–8°C", 2, 8], ["Cool 8–15°C", 8, 15], ["Room 15–30°C", 15, 30]].map(([l, a, b]) => (
                    <button key={l} type="button" onClick={() => setF({ ...f, min: a, max: b })} className={cx("rounded-full border px-3 py-1 text-xs", Number(f.min) === a && Number(f.max) === b ? "border-brand/60 text-teal-200" : "border-white/15 text-slate-400 hover:text-white")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Max humidity (%RH)" hint="0 turns the humidity check off.">
                <Input type="number" min={0} max={100} value={f.hum} onChange={set("hum")} data-testid="nb-hum" />
              </Field>
              <Notice tone="info" className="sm:col-span-2">A smart box that reports outside these limits quarantines the batch automatically.</Notice>
            </>
          )}
          {step === 3 && (
            <Field label="Certificate of analysis / QC notes" hint="Kept off-chain; its fingerprint (hash) is anchored on-chain so it can't be changed later." className="sm:col-span-2">
              <Textarea value={f.notes} onChange={set("notes")} placeholder="Composition, QC report number, release date…" />
            </Field>
          )}
          {step === 4 && (
            <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/10 text-sm sm:col-span-2">
              {[
                ["Medicine", f.productName],
                ["Sale", f.rxOnly ? "Prescription only" : "Over the counter"],
                ["Lot", f.lotNumber],
                ["Strips", f.quantity],
                ["Expiry", f.expiry],
                ["Storage", `${f.min}–${f.max}°C${Number(f.hum) ? `, ≤ ${f.hum}% RH` : ""}`],
                ["Signatures", `${txs} (1 batch + ${txs - 1} for strip codes)`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {step === 5 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center sm:col-span-2" data-testid="nb-result">
              <SmartBox state={done ? "sealed" : "checking"} size={200} label={done ? "Batch sealed" : "Generating strip codes…"} />
              {progress && (
                <div className="w-full max-w-sm">
                  <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-brand transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
                  <div className="mt-2 text-xs text-slate-400">{progress.done} of {progress.total} strips serialised</div>
                </div>
              )}
              {done && (
                <>
                  <div className="flex items-center gap-2 text-lg font-semibold text-white"><CheckCircle2 className="h-5 w-5 text-brand" /> Batch #{created} is on-chain</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href={`/manufacturer/batches/${created}/labels`}><Button data-testid="nb-labels"><Printer className="h-4 w-4" /> Print strip labels</Button></Link>
                    <Link href={`/manufacturer/batches/${created}`}><Button variant="secondary">Open batch</Button></Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {step < 5 && (
          <div className="mt-6 flex justify-between gap-2">
            <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            <Button type="submit" loading={busy} data-testid={step < 4 ? "nb-next" : "nb-submit"}>{step < 4 ? "Continue" : "Sign & create batch"}</Button>
          </div>
        )}
      </form>
    </div>
  );
}
