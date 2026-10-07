"use client";
import { useMemo, useState } from "react";
import { isAddress, keccak256, stringToHex } from "viem";
import { useAllBatches } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { authedFetch } from "@/lib/session";
import { useWorkspace } from "@/components/Workspace";
import { trustChain } from "@/lib/config";
import { parseWalletQr } from "@/lib/qr";
import QrScanner from "@/components/QrScanner";
import RxCard from "@/components/rx/RxCard";
import { Button, Card, Field, Input, Notice, PageHeader, Textarea } from "@/components/ui";

export default function NewPrescription() {
  const { me } = useWorkspace();
  const { send, pending } = useTx();
  const batches = useAllBatches();
  const products = useMemo(() => [...new Set((batches.data ?? []).filter((b) => b.status === 0).map((b) => b.productName))].sort(), [batches.data]);
  const [f, setF] = useState({ patient: "", medicine: "", dose: "", days: 7, allowance: 2 });
  const [issued, setIssued] = useState(null);
  const [warn, setWarn] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const text = `${f.medicine}${f.dose ? ` · ${f.dose}` : ""}`.trim();

  async function issue(e) {
    e.preventDefault();
    setWarn(null);
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + Number(f.days) * 86400);
    const res = await send({
      contract: trustChain,
      functionName: "issuePrescription",
      args: [f.patient, keccak256(stringToHex(text)), validUntil, Number(f.allowance)],
      label: "Sign prescription",
      success: "Prescription signed on-chain",
    });
    if (!res) return;
    const id = Number(res.result);
    try {
      await authedFetch(`/api/prescriptions/${id}/details`, me.address, { method: "PUT", body: JSON.stringify({ text }) });
    } catch (err) {
      setWarn(`Signed on-chain, but the medicine details could not be saved (${err.message}). The pharmacy will see the prescription without details.`);
    }
    setIssued({ id, patient: f.patient, text, allowance: Number(f.allowance), validUntil: Number(validUntil) });
    setF({ patient: "", medicine: "", dose: "", days: 7, allowance: 2 });
  }

  return (
    <>
      <PageHeader eyebrow="New prescription" n={1} title={me.participant.name} subtitle={`Doctor · registration ${me.participant.licenseId || "—"}`} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Write" subtitle="Medicine details are stored encrypted; only a fingerprint goes on-chain." className="lg:col-span-2">
          <form onSubmit={issue} className="space-y-4">
            <Field label="Patient" hint="Scan the QR on the patient's “My medicines” page, or paste their address.">
              <div className="flex gap-2">
                <Input required value={f.patient} onChange={(e) => setF({ ...f, patient: e.target.value.trim() })} placeholder="0x…" className="font-mono" data-testid="rx-patient" />
                <QrScanner onResult={(t) => setF((x) => ({ ...x, patient: parseWalletQr(t) ?? "" }))} label="Scan" size="sm" />
              </div>
            </Field>
            <Field label="Medicine">
              <Input required list="tc-products" value={f.medicine} onChange={set("medicine")} placeholder="Start typing…" data-testid="rx-medicine" />
              <datalist id="tc-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Dose & duration">
              <Textarea value={f.dose} onChange={set("dose")} placeholder="1 tablet three times a day for 5 days" className="min-h-16" data-testid="rx-dose" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valid for (days)"><Input required type="number" min={1} max={365} value={f.days} onChange={set("days")} data-testid="rx-days" /></Field>
              <Field label="Strips allowed"><Input required type="number" min={1} max={500} value={f.allowance} onChange={set("allowance")} data-testid="rx-allowance" /></Field>
            </div>
            <Button type="submit" className="w-full" disabled={!isAddress(f.patient) || !f.medicine} loading={pending === "issuePrescription"} data-testid="rx-submit">
              Sign prescription
            </Button>
          </form>
        </Card>
        <div className="space-y-4 lg:col-span-3">
          {warn && <Notice tone="warn">{warn}</Notice>}
          {issued ? (
            <RxCard id={issued.id} doctorName={me.participant.name} patient={issued.patient} text={issued.text} allowance={issued.allowance} validUntil={issued.validUntil} />
          ) : (
            <div className="card grid min-h-64 place-items-center p-6 text-center text-sm text-slate-500">
              The signed prescription card with its QR code appears here. The patient shows it at the pharmacy.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
