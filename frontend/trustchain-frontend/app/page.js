"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { codeHashOf, parseStripCode } from "@/lib/qr";
import { useApi, useNames, useParticipants } from "@/lib/hooks";
import { describe, toneOf } from "@/lib/activity";
import { locate } from "@/lib/geo";
import { ROLE_META, ROLE_ORDER } from "@/lib/roles";
import { dateTime } from "@/lib/format";
import Globe from "@/components/fx/Globe";
import SmartBox from "@/components/fx/SmartBox";
import { ReceiptArt, StripArt, VerdictArt } from "@/components/fx/Illustrations";
import QrScanner from "@/components/QrScanner";
import { CountUp, Eyebrow, Reveal } from "@/components/fx/motion";
import { Button, Input, cx } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const people = useParticipants();
  const ships = useApi("/api/shipments?status=InTransit", { refetchInterval: 20000 });
  const activity = useApi("/api/activity?limit=24", { refetchInterval: 15000 });
  const stats = useApi("/api/stats", { refetchInterval: 20000 });
  const name = useNames();

  const where = Object.fromEntries((people.data ?? []).map((p) => [p.address.toLowerCase(), locate(p.location)]));
  const markers = Object.values(where).filter(Boolean).map((location) => ({ location, size: 0.05 }));
  const arcs = (ships.data ?? [])
    .map((s) => ({ from: where[s.from_addr.toLowerCase()], to: where[s.to_addr.toLowerCase()], tone: s.breached ? "rose" : "teal" }))
    .filter((a) => a.from && a.to);
  for (const s of ships.data ?? []) if (s.breached && where[s.to_addr.toLowerCase()]) markers.push({ location: where[s.to_addr.toLowerCase()], size: 0.09, tone: "rose" });

  function check(text) {
    const secret = parseStripCode(text);
    if (!secret) return setError("That's not a TrustChain code. It starts with TC1:");
    router.push(`/verify?h=${codeHashOf(secret)}`);
  }

  const latest = (n) => (activity.data ?? []).find((e) => e.name === n);
  const chapters = [
    { n: 1, title: "Made.", body: "A licensed manufacturer mints the batch on the blockchain and prints a secret QR code on every strip.", ex: latest("BatchCreated") },
    { n: 2, title: "Moved.", body: "It travels sealed in a smart box that signs temperature, humidity, GPS and lid status. A breach freezes the batch.", ex: latest("ShipmentCreated") },
    { n: 3, title: "Sold.", body: "The pharmacy scans each strip at the counter. Prescription-only medicine needs a doctor's on-chain prescription.", ex: latest("StripDispensed") },
    { n: 4, title: "Verified.", body: "Anyone scans the strip: genuine, already sold (a copied code), recalled, on hold or expired, in a second.", ex: null },
  ];

  return (
    <div className="-mt-8 sm:-mt-10">
      <section className="grid items-center gap-10 py-8 sm:py-12 lg:grid-cols-2 lg:py-20 [&>*]:min-w-0">
        <Reveal>
          <Eyebrow n={1}>Know your medicine</Eyebrow>
          <h1 className="display mt-6 text-5xl sm:text-7xl">
            Is it <span className="text-brand">real</span>?<br />
            Ask the <span className="text-brand">chain.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-slate-300">
            Up to 1 in 10 medicines in low- and middle-income countries is substandard or falsified. TrustChain tracks every strip from the factory to your hand.
          </p>
          <form className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); check(code); }}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code from your strip (TC1:…)" className="h-12 font-mono" aria-label="Strip code" />
            <Button type="submit" size="lg" className="h-12">Verify</Button>
            <QrScanner onResult={check} label="Scan" />
          </form>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
          <Link href="/portal" className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            Part of the supply chain? Open your portal <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
        <div className="flex justify-center">
          <Globe markers={markers} arcs={arcs} size={540} />
        </div>
      </section>

      {/* live ticker */}
      {activity.data?.length > 0 && (
        <div className="relative -mx-4 overflow-hidden border-y border-white/[0.06] bg-black/20 py-3 sm:-mx-6" aria-label="Live network activity">
          <div className="ticker-track flex w-max gap-10 whitespace-nowrap px-6 text-sm">
            {[...activity.data, ...activity.data].map((e, i) => (
              <span key={i} className="flex items-center gap-2 text-slate-300">
                <span className={cx("h-1.5 w-1.5 rounded-full", toneOf(e) === "rose" ? "bg-danger" : "bg-brand")} />
                {describe(e, name)}
                <span className="text-slate-500">{dateTime(e.timestamp)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.data && (
        <section className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Batches on-chain", stats.data.batches], ["Shipments tracked", stats.data.shipments], ["Signed box reports", stats.data.telemetryReports], ["Strips dispensed", stats.data.stripsDispensed]].map(([l, v]) => (
            <div key={l} className="card px-4 py-5 text-center">
              <div className="text-4xl font-bold text-white"><CountUp value={v} /></div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{l}</div>
            </div>
          ))}
        </section>
      )}

      {/* chapters */}
      <section className="mt-24 space-y-24">
        {chapters.map((c, i) => (
          <Reveal key={c.n} className={cx("grid items-center gap-10 lg:grid-cols-2", i % 2 && "lg:[&>*:first-child]:order-2")}>
            <div>
              <Eyebrow n={c.n + 1}>{["Made", "Moved", "Sold", "Verified"][i]}</Eyebrow>
              <h2 className="display mt-5 text-5xl sm:text-6xl">{c.title}</h2>
              <p className="mt-5 max-w-md text-lg text-slate-300">{c.body}</p>
              {c.ex && (
                <div className="card mt-6 inline-flex items-center gap-3 px-4 py-3 text-sm text-slate-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                  Latest: {describe(c.ex, name)} · {dateTime(c.ex.timestamp)}
                </div>
              )}
            </div>
            <div className="flex justify-center">
              {[<StripArt key="a" />, <SmartBox key="b" state="sealed" size={300} />, <ReceiptArt key="c" />, <VerdictArt key="d" />][i]}
            </div>
          </Reveal>
        ))}
      </section>

      {/* portals */}
      <section className="mt-28 pb-6">
        <Reveal>
          <Eyebrow n={6}>Portals</Eyebrow>
          <h2 className="display mt-5 text-4xl sm:text-5xl">Who are you?</h2>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.map((k) => {
            const m = ROLE_META[k];
            return (
              <Link key={k} href={`/portal/${k}`} className="card card-hover group flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25"><m.icon className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block font-semibold text-white">{m.title}</span>
                  <span className="block text-xs text-slate-400">{m.blurb}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-brand" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
