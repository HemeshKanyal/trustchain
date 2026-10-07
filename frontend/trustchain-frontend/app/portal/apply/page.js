"use client";
import { useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CheckCircle2, FileUp, Hourglass } from "lucide-react";
import { useApi, useMe } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { authedFetch, useSession } from "@/lib/session";
import { trustChain } from "@/lib/config";
import { ROLE_META, roleKeyOf } from "@/lib/roles";
import { ROLES, date } from "@/lib/format";
import { DevAccountPicker } from "@/components/Wallet";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Badge, Button, Field, Input, Notice, Select, Spinner, cx } from "@/components/ui";

const STEPS = ["Who you are", "Licence", "Review & sign"];

export default function ApplyPage() {
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  if (!me.isConnected)
    return (
      <Shell>
        <div className="card space-y-4 p-6">
          <Notice tone="info">Connect the wallet your organisation will use on TrustChain. It becomes your sign-in.</Notice>
          <Button className="w-full" onClick={openConnectModal}>Connect wallet</Button>
          <DevAccountPicker />
        </div>
      </Shell>
    );
  if (me.loading) return <Spinner />;
  if (me.role) {
    const key = me.isAdmin ? "admin" : roleKeyOf(me.role);
    return (
      <Shell>
        <div className="card p-6">
          <Notice tone="ok" icon={CheckCircle2} title={`You are registered as ${ROLES[me.role]}`}>
            <Link className="text-white underline" href={`/portal/${key}?org=${me.address}`}>Sign in to your workspace</Link>
          </Notice>
        </div>
      </Shell>
    );
  }
  if (me.application) return <Pending app={me.application} address={me.address} />;
  return <Wizard address={me.address} />;
}

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <Eyebrow n={3}>Apply</Eyebrow>
        <h1 className="display mt-5 text-4xl sm:text-6xl">
          Join the <span className="text-brand">network</span>.
        </h1>
        <p className="mt-4 text-slate-400">The regulator checks every organisation before it can make, move, sell or prescribe medicine.</p>
      </Reveal>
      <div className="mt-10">{children}</div>
    </div>
  );
}

function Wizard({ address }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ role: "4", name: "", location: "", licenseId: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { send } = useTx();
  const session = useSession();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const meta = ROLE_META[roleKeyOf(Number(f.role))];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (file) {
        if (!session.valid) await session.signIn();
        const data = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await authedFetch("/api/applications/document", address, { method: "PUT", body: JSON.stringify({ name: file.name, mime: file.type, data }) });
      }
      await send({ contract: trustChain, functionName: "applyForRole", args: [Number(f.role), f.name.trim(), f.location.trim(), f.licenseId.trim()], label: "Submit application", success: "Application submitted to the regulator" });
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <ol className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cx("flex-1 rounded-xl border px-3 py-2 text-xs", i === step ? "border-brand/50 bg-brand/[0.08] text-white" : i < step ? "border-white/10 text-teal-300" : "border-white/10 text-slate-500")}>
            <span className="font-semibold tracking-[0.2em]">0{i + 1}</span> <span className="ml-1">{s}</span>
          </li>
        ))}
      </ol>
      <form
        className="card space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) setStep(step + 1);
          else submit();
        }}
      >
        {step === 0 && (
          <>
            <Field label="I am a">
              <Select value={f.role} onChange={set("role")} data-testid="apply-role">
                {[2, 3, 4, 5].map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
              </Select>
            </Field>
            <p className="-mt-2 text-xs text-slate-500">{meta?.blurb}</p>
            <Field label="Organisation / full name">
              <Input required value={f.name} onChange={set("name")} data-testid="apply-name" />
            </Field>
            <Field label="City" hint="Used to place you on the network map.">
              <Input required value={f.location} onChange={set("location")} placeholder="Pune, MH" data-testid="apply-location" />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Licence / registration number">
              <Input required value={f.licenseId} onChange={set("licenseId")} data-testid="apply-license" />
            </Field>
            <Field label="Licence document (optional)" hint="PDF, PNG or JPEG under 4 MB. Only the regulator can open it.">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-5 text-sm text-slate-300 hover:border-brand/40">
                <FileUp className="h-5 w-5 text-brand" />
                {file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Choose a file"}
                <input type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="apply-file" />
              </label>
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <dl className="divide-y divide-white/[0.06] rounded-xl border border-white/10 text-sm">
              {[
                ["Role", ROLES[Number(f.role)]],
                ["Name", f.name],
                ["City", f.location],
                ["Licence", f.licenseId],
                ["Document", file ? file.name : "None"],
                ["Wallet", address],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate text-right text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            <Notice tone="info">Signing records your application on the blockchain. {file ? "You'll also sign a free message so the document upload is tied to your wallet." : ""}</Notice>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </>
        )}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          <Button type="submit" loading={busy} data-testid={step < 2 ? "apply-next" : "apply-submit"}>
            {step < 2 ? "Continue" : "Sign & submit"}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Pending({ app, address }) {
  const doc = useApi(`/api/applications/${address}/document/meta`);
  return (
    <Shell>
      <div className="card p-6" data-testid="application-pending">
        <div className="flex items-start gap-4">
          <Hourglass className="mt-1 h-6 w-6 shrink-0 text-amber-300" />
          <div>
            <div className="text-lg font-semibold text-white">Waiting for the regulator</div>
            <p className="mt-1 text-sm text-slate-400">
              You applied as <Badge tone="brand">{ROLES[Number(app.role)]}</Badge> &quot;{app.name}&quot; on {date(app.appliedAt)}. This page updates by itself when you are approved.
            </p>
            {doc.data && <p className="mt-2 text-xs text-slate-500">Document attached: {doc.data.name} (sha256 {doc.data.sha256.slice(0, 12)}…)</p>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
