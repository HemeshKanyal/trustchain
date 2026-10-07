"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Search } from "lucide-react";
import { useApi, useParticipants } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { ROLE_META } from "@/lib/roles";
import OrgCard from "@/components/OrgCard";
import SignInPanel from "@/components/SignInPanel";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Button, Empty, Input, Notice, Select, Spinner } from "@/components/ui";
import { DevAccountPicker } from "@/components/Wallet";

export default function RolePortal() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { role } = useParams();
  const meta = ROLE_META[role];
  if (!meta) notFound();
  return meta.role === 0 ? <PatientPortal /> : <Directory meta={meta} />;
}

function Directory({ meta }) {
  const params = useSearchParams();
  const { data, isLoading } = useParticipants();
  const stats = useApi("/api/orgs/stats", { refetchInterval: 30000 });
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("all");
  const [picked, setPicked] = useState(null);
  const [skipPreselect, setSkipPreselect] = useState(false);

  const all = useMemo(() => (data ?? []).filter((p) => p.role === meta.role), [data, meta.role]);
  const cities = [...new Set(all.map((p) => (p.location || "").split(",")[0].trim()).filter(Boolean))].sort();
  const list = all.filter((p) => {
    const hay = `${p.name} ${p.location} ${p.licenseId} ${p.address}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (!city || (p.location || "").startsWith(city)) && (status === "all" || (status === "active") === p.active);
  });

  const preselect = params.get("org");
  const preselected = !skipPreselect && preselect ? all.find((p) => p.address.toLowerCase() === preselect.toLowerCase()) : null;
  const selected = picked ?? preselected ?? null;
  const setSelected = (p) => {
    setPicked(p);
    if (!p) setSkipPreselect(true);
  };

  return (
    <div>
      <Reveal>
        <Eyebrow n={2}>{meta.title} portal</Eyebrow>
        <h1 className="display mt-5 text-4xl sm:text-6xl">
          Find your <span className="text-brand">{meta.title.toLowerCase()}</span>.
        </h1>
        <p className="mt-4 max-w-xl text-slate-400">Search the {meta.plural} registered on TrustChain. Select yours, then sign in with its wallet.</p>
      </Reveal>

      <div className="card mt-10 flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, licence or wallet" className="pl-10" aria-label="Search organisations" data-testid="directory-search" />
        </div>
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="sm:w-44" aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-36" aria-label="Status">
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : !list.length ? (
          <div className="card">
            <Empty title={all.length ? "No match" : `No ${meta.plural} registered yet`}>
              <Link className="text-brand underline" href="/portal/apply">Apply to join as a {meta.title.toLowerCase()}</Link>
            </Empty>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <OrgCard key={p.address} org={p} stats={stats.data?.[p.address]} onClick={() => setSelected(p)} selected={selected?.address === p.address} testId={`org-${p.address}`} />
            ))}
          </div>
        )}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        Not listed? <Link href="/portal/apply" className="text-brand hover:underline">Apply to join</Link>
      </p>
      {selected && <SignInPanel org={selected} roleKey={meta.key} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PatientPortal() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { valid, signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (isConnected && valid) router.push("/me");
  }, [isConnected, valid, router]);
  return (
    <div className="mx-auto max-w-xl text-center">
      <Eyebrow n={2} className="justify-center">Patient</Eyebrow>
      <h1 className="display mt-5 text-4xl sm:text-6xl">
        Your <span className="text-brand">medicine cabinet</span>.
      </h1>
      <p className="mt-4 text-slate-400">See every medicine a pharmacy dispensed to your wallet, your prescriptions, and recall warnings. Only you can open it.</p>
      <div className="card mt-10 space-y-4 p-6 text-left">
        {!isConnected ? (
          <>
            <Notice tone="info">Connect the wallet your doctor and pharmacy use for you.</Notice>
            <Button className="w-full" onClick={openConnectModal}>Connect wallet</Button>
            <DevAccountPicker />
          </>
        ) : (
          <>
            <Notice tone="ok">Sign one free message to prove the wallet is yours. No transaction is sent.</Notice>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <Button
              className="w-full"
              loading={busy}
              data-testid="patient-signin"
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await signIn();
                } catch (e) {
                  setError(e?.shortMessage ?? e?.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Open my medicines
            </Button>
          </>
        )}
        <p className="text-xs text-slate-500">
          Just checking a strip? <Link href="/verify" className="text-brand">Verify it here</Link>, no wallet needed.
        </p>
      </div>
    </div>
  );
}
