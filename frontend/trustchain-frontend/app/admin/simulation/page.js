"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, Copy, DoorOpen, Pause, Play, Siren, Tags, ThermometerSun, Truck, WifiOff } from "lucide-react";
import { useWorkspace } from "@/components/Workspace";
import { Badge, Button, Card, Empty, Notice, PageHeader, Stat } from "@/components/ui";
import { authedFetch } from "@/lib/session";
import { api } from "@/lib/api";
import { time } from "@/lib/format";

const SCENARIOS = [
  { key: "heat", icon: ThermometerSun, title: "Reefer failure", text: "The cooling on a cold-chain truck dies. Its box signs the rising temperature, the monitor contract quarantines the batch, and the regulator reviews it.", watch: "Alerts, then the shipment page" },
  { key: "lid", icon: DoorOpen, title: "Box opened in transit", text: "Someone opens a box on the road. The tamper flag is signed into the next report.", watch: "Alerts" },
  { key: "sensor", icon: WifiOff, title: "Sensor drop-out", text: "The temperature sensor stops answering for a while; the gap shows up in the cold-chain analysis.", watch: "Shipment page, AI risk" },
  { key: "counterfeit-wave", icon: Bug, title: "Counterfeit wave", text: "A ring of buyers scans 14 QR codes that were never registered on-chain.", watch: "AI risk (unknown-code bursts)" },
  { key: "clone", icon: Copy, title: "Copied QR code", text: "One already-sold strip is scanned by four different people: the code was copied.", watch: "AI risk for that batch" },
  { key: "recall", icon: Siren, title: "Manufacturer recall", text: "A manufacturer recalls a live batch. Every holder ships its strips back on-chain.", watch: "Recalls & alerts" },
  { key: "price-dump", icon: Tags, title: "Price dumping", text: "One pharmacy sells far below market for 15 minutes.", watch: "AI risk prices, compliance" },
];
const KIND_TONE = { batch: "brand", ship: "info", deliver: "ok", fault: "warn", recall: "danger", release: "ok", return: "warn", scenario: "brand", error: "danger" };

export default function Page() {
  const { me } = useWorkspace();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const status = useQuery({ queryKey: ["sim-admin", me.address], queryFn: () => authedFetch("/api/sim/admin", me.address), refetchInterval: 3000, enabled: Boolean(me.address) });
  const events = useQuery({ queryKey: ["sim-events"], queryFn: () => api("/api/sim/events?after=0"), refetchInterval: 3000 });
  const s = status.data;

  async function act(path, label) {
    setBusy(path);
    try {
      const out = await authedFetch(`/api/sim/${path}`, me.address, { method: "POST" });
      toast.success(label, { description: out.shipmentId ? `Shipment #${out.shipmentId}` : out.batchId ? `Batch #${out.batchId}` : out.queued ? "It will hit the next monitored truck." : undefined });
      qc.invalidateQueries({ queryKey: ["sim-admin"] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Simulation"
      n={8}
      title="Showcase network"
      subtitle="Fictional organisations, real transactions: every batch, shipment, signed reading and sale below is on-chain."
      actions={
        s?.running && (
          <Button variant="secondary" loading={busy === "pause" || busy === "resume"} onClick={() => act(s.paused ? "resume" : "pause", s.paused ? "Simulation resumed" : "Simulation paused")}>
            {s.paused ? <Play className="size-4" /> : <Pause className="size-4" />} {s.paused ? "Resume" : "Pause"}
          </Button>
        )
      }
    />
  );

  if (status.isLoading) return header;
  if (!s?.running)
    return (
      <>
        {header}
        <Notice title="The simulator isn't running">
          Start it next to the backend with <code className="text-teal-300">npm run sim</code> (or <code className="text-teal-300">SIM_PRESET=live npm run sim</code> on Sepolia). Its organisations carry SIM- licences, so the site labels them as simulated.
        </Notice>
      </>
    );

  const c = s.counters;
  const nowS = Date.now() / 1000;
  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Transactions" value={c.tx.toLocaleString()} sub={`${Number(c.gasEth).toFixed(4)} ETH gas`} />
        <Stat label="Strips sold" value={c.sales.toLocaleString()} sub={`${c.prescriptions} prescriptions`} />
        <Stat label="Trips completed" value={c.trips.toLocaleString()} sub={`${s.trips.length} on the road`} />
        <Stat label="Signed box reports" value={c.reports.toLocaleString()} sub={`${c.scans} Verify scans`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card title="Showcase scenarios" subtitle="Each one triggers real behaviour; the AI and alerts react on their own.">
          <div className="grid gap-3 sm:grid-cols-2">
            {SCENARIOS.map(({ key, icon: Icon, title, text, watch }) => (
              <div key={key} className="flex flex-col rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Icon className="size-4 text-teal-300" /> {title}
                </div>
                <p className="mt-1 flex-1 text-sm text-slate-400">{text}</p>
                <div className="mt-2 text-xs text-slate-500">Watch: {watch}</div>
                <Button size="sm" className="mt-3 self-start" loading={busy === `scenario/${key}`} disabled={s.paused} onClick={() => act(`scenario/${key}`, title)}>
                  Run
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid content-start gap-6">
          <Card title="On the road" subtitle={`${s.boxes.filter((b) => b.busy).length} of ${s.boxes.length} smart boxes in use`}>
            {s.trips.length === 0 ? (
              <Empty icon={Truck} title="No trucks moving">Restocking starts when shelves run low.</Empty>
            ) : (
              <ul className="grid gap-3">
                {s.trips.slice(0, 12).map((t) => {
                  const f = Math.min(1, Math.max(0, (nowS - t.startedAt) / (t.endsAt - t.startedAt)));
                  return (
                    <li key={t.id}>
                      <Link href={`/shipment/${t.id}`} className="block rounded-lg p-2 hover:bg-white/[0.04]">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-slate-200">
                            #{t.id} {t.from} → {t.to}
                          </span>
                          {t.box ? <Badge tone={t.cold ? "info" : "neutral"}>{t.cold ? "reefer" : "tracked"}</Badge> : <Badge tone="warn">no tracker</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {t.qty} strips · {t.km} km · batch #{t.batchId}
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-teal-400" style={{ width: `${f * 100}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6" title="What's happening" subtitle="Newest first">
        <ul className="divide-y divide-white/5">
          {(events.data ?? []).slice().reverse().slice(0, 80).map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 whitespace-nowrap tabular-nums text-xs text-slate-500">{time(e.at)}</span>
              <Badge tone={KIND_TONE[e.kind] ?? "neutral"} className="shrink-0">{e.kind}</Badge>
              <span className="min-w-0 text-slate-300">
                {e.text}{" "}
                {e.shipmentId ? <Link className="text-teal-300 hover:underline" href={`/shipment/${e.shipmentId}`}>view</Link> : e.batchId ? <Link className="text-teal-300 hover:underline" href={`/batch/${e.batchId}`}>view</Link> : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6" title="Simulated organisations" subtitle={`Regulator wallet ${s.regulator}`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {s.orgs.map((o) => (
            <Link key={o.id} href={`/network/${o.address}`} className="rounded-lg p-2 text-sm hover:bg-white/[0.04]">
              <div className="truncate font-medium text-slate-200">{o.name}</div>
              <div className="text-xs text-slate-500">
                {o.city}
                {o.balance != null && ` · ${Number(o.balance).toFixed(3)} ETH`}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
