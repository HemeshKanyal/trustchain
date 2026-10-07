"use client";
import { useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { UserPlus, Radio, FileText } from "lucide-react";
import { useApi, usePaused } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { authedFetch } from "@/lib/session";
import { coldChainMonitor, trustChain, CHAIN_ID, chain } from "@/lib/config";
import { ROLES, date, dateTime, isSimulated, short } from "@/lib/format";
import { BatchStatus } from "@/components/status";
import { Address, Badge, Button, Card, Empty, Field, Input, Modal, Notice, Select, SimBadge, Spinner, Textarea } from "@/components/ui";

function DocLink({ address, admin }) {
  const meta = useApi(`/api/applications/${address}/document/meta`);
  if (!meta.data) return <span className="text-xs text-slate-500">None</span>;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
      onClick={async () => {
        const blob = await authedFetch(`/api/applications/${address}/document`, admin);
        window.open(URL.createObjectURL(blob), "_blank");
      }}
    >
      <FileText className="h-3.5 w-3.5" /> {meta.data.name}
    </button>
  );
}

export function Applications({ q, admin }) {
  const { send } = useTx();
  if (q.isLoading) return <Spinner />;
  return (
    <Card title="Pending applications" subtitle="Check licence numbers against the official registry before approving.">
      {!q.data?.length ? (
        <Empty title="No pending applications" />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="pl-5">Applicant</th>
                <th>Role</th>
                <th>Location</th>
                <th>Licence</th>
                <th>Document</th>
                <th>Applied</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {q.data.map((a) => (
                <tr key={a.address} data-testid="application-row">
                  <td className="pl-5"><Address address={a.address} name={a.name} /></td>
                  <td><Badge tone="brand">{ROLES[a.role]}</Badge></td>
                  <td>{a.location || "—"}</td>
                  <td className="font-mono text-xs">{a.licenseId || "—"}</td>
                  <td><DocLink address={a.address} admin={admin} /></td>
                  <td className="text-xs text-slate-400">{date(a.appliedAt)}</td>
                  <td className="pr-5">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => send({ contract: trustChain, functionName: "approveApplication", args: [a.address], label: `Approve ${a.name}` })} data-testid="approve">
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => send({ contract: trustChain, functionName: "rejectApplication", args: [a.address], label: `Reject ${a.name}` })}>
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function Participants({ me, q }) {
  const { send } = useTx();
  const [filter, setFilter] = useState(0);
  const [adding, setAdding] = useState(false);
  const rows = (q.data ?? []).filter((p) => !filter || p.role === filter);
  return (
    <Card
      title="Participants"
      actions={
        <>
          <Select value={filter} onChange={(e) => setFilter(Number(e.target.value))} className="w-auto py-1.5 text-xs" aria-label="Filter by role">
            <option value={0}>All roles</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>{ROLES[r]}s</option>
            ))}
          </Select>
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Register
          </Button>
        </>
      }
    >
      {q.isLoading ? (
        <Spinner />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="pl-5">Participant</th>
                <th>Role</th>
                <th>Location</th>
                <th>Licence</th>
                <th>Since</th>
                <th>Status</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isOwner = p.address.toLowerCase() === me.owner?.toLowerCase();
                const canToggle = !isOwner && (p.role !== 1 || me.isOwner);
                return (
                  <tr key={p.address}>
                    <td className="pl-5"><Address address={p.address} name={p.name} /></td>
                    <td><Badge tone={p.role === 1 ? "info" : "brand"}>{ROLES[p.role]}</Badge></td>
                    <td>{p.location || "—"}</td>
                    <td className="font-mono text-xs">{p.licenseId || "—"}{isSimulated(p) && <SimBadge className="ml-2" />}</td>
                    <td className="text-xs text-slate-400">{date(p.registeredAt)}</td>
                    <td>{p.active ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</td>
                    <td className="pr-5 text-right">
                      {canToggle && (
                        <Button
                          size="sm"
                          variant={p.active ? "ghost" : "secondary"}
                          onClick={() => send({ contract: trustChain, functionName: "setParticipantActive", args: [p.address, !p.active], label: `${p.active ? "Suspend" : "Reinstate"} ${p.name}` })}
                        >
                          {p.active ? "Suspend" : "Reinstate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <RegisterModal open={adding} onClose={() => setAdding(false)} isOwner={me.isOwner} />
    </Card>
  );
}

export function RegisterModal({ open, onClose, isOwner }) {
  const { send, pending } = useTx();
  const [f, setF] = useState({ address: "", role: "2", name: "", location: "", licenseId: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title="Register a participant">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send({ contract: trustChain, functionName: "registerParticipant", args: [f.address, Number(f.role), f.name, f.location, f.licenseId], label: `Register ${f.name}` });
          if (ok) {
            setF({ address: "", role: "2", name: "", location: "", licenseId: "" });
            onClose();
          }
        }}
      >
        <Field label="Wallet address">
          <Input required value={f.address} onChange={set("address")} className="font-mono" placeholder="0x…" />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={set("role")}>
            {[2, 3, 4, 5, ...(isOwner ? [1] : [])].map((r) => (
              <option key={r} value={r}>{ROLES[r]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Input required value={f.name} onChange={set("name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Input value={f.location} onChange={set("location")} />
          </Field>
          <Field label="Licence">
            <Input value={f.licenseId} onChange={set("licenseId")} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!isAddress(f.address)} loading={pending === "registerParticipant"}>Register</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Devices({ q }) {
  const { send, pending } = useTx();
  const status = useApi("/api/devices", { refetchInterval: 10000 });
  const [f, setF] = useState({ address: "", label: "" });
  const last = Object.fromEntries((status.data ?? []).map((d) => [d.address.toLowerCase(), d.lastReport]));
  const busy = Object.fromEntries((status.data ?? []).map((d) => [d.address.toLowerCase(), d.activeShipment]));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Register a smart box" subtitle="The ESP32 prints its address on boot (serial monitor command: addr).">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send({ contract: coldChainMonitor, functionName: "registerDevice", args: [f.address, f.label], label: `Register ${f.label}` });
            if (ok) setF({ address: "", label: "" });
          }}
        >
          <Field label="Device address">
            <Input required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value.trim() })} className="font-mono" placeholder="0x…" data-testid="device-address" />
          </Field>
          <Field label="Label">
            <Input required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="SmartBox-002" data-testid="device-label" />
          </Field>
          <Button type="submit" className="w-full" disabled={!isAddress(f.address)} loading={pending === "registerDevice"} data-testid="device-submit">
            Register box
          </Button>
        </form>
      </Card>
      <Card title="Smart boxes" className="lg:col-span-2">
        {q.isLoading ? (
          <Spinner />
        ) : !q.data?.length ? (
          <Empty icon={Radio} title="No boxes registered" />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="pl-5">Box</th>
                  <th>Registered</th>
                  <th>Last report</th>
                  <th>In use</th>
                  <th>Status</th>
                  <th className="pr-5" />
                </tr>
              </thead>
              <tbody>
                {q.data.map((d) => {
                  const r = last[d.address.toLowerCase()];
                  return (
                    <tr key={d.address}>
                      <td className="pl-5"><Address address={d.address} name={d.label} /></td>
                      <td className="text-xs text-slate-400">{date(d.registeredAt)}</td>
                      <td className="text-xs">{r ? <Link className="text-brand hover:underline" href={`/shipment/${r.shipmentId}`}>{dateTime(r.windowEnd)} · #{r.shipmentId}</Link> : "—"}</td>
                      <td>{busy[d.address.toLowerCase()] ? <Link className="text-xs text-brand hover:underline" href={`/shipment/${busy[d.address.toLowerCase()]}`}>Shipment #{busy[d.address.toLowerCase()]}</Link> : <span className="text-xs text-slate-500">Free</span>}</td>
                      <td>{d.active ? <Badge tone="ok">Active</Badge> : <Badge>Disabled</Badge>}</td>
                      <td className="pr-5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => send({ contract: coldChainMonitor, functionName: "setDeviceActive", args: [d.address, !d.active], label: `${d.active ? "Disable" : "Enable"} ${d.label}` })}>
                          {d.active ? "Disable" : "Enable"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function Batches({ q }) {
  const { send } = useTx();
  const [action, setAction] = useState(null);
  const [text, setText] = useState("");
  const rows = [...(q.data ?? [])].sort((a, b) => (b.status === 1) - (a.status === 1) || b.id - a.id);

  async function submit(e) {
    e.preventDefault();
    const { kind, batch } = action;
    const args = kind === "hold" ? [BigInt(batch.id), 0n, 16] : [BigInt(batch.id), text];
    const fn = { hold: "quarantineBatch", release: "releaseQuarantine", recall: "recallBatch" }[kind];
    const ok = await send({ contract: trustChain, functionName: fn, args, label: `${kind[0].toUpperCase()}${kind.slice(1)} batch #${batch.id}` });
    if (ok) {
      setAction(null);
      setText("");
    }
  }

  return (
    <Card title="All batches" subtitle="Quarantined batches need a regulator decision: release after lab review, or recall.">
      {q.isLoading ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty title="No batches yet" />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="pl-5">Batch</th>
                <th>Medicine</th>
                <th>Manufacturer</th>
                <th>Expires</th>
                <th>Status</th>
                <th className="pr-5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} data-testid={`admin-batch-${b.id}`}>
                  <td className="pl-5"><Link className="font-medium text-white hover:text-brand" href={`/batch/${b.id}`}>#{b.id}</Link><div className="text-xs text-slate-500">{b.lotNumber}</div></td>
                  <td>{b.productName}</td>
                  <td className="font-mono text-xs">{short(b.manufacturer)}</td>
                  <td className="text-xs text-slate-400">{date(b.expiresAt)}</td>
                  <td><BatchStatus batch={b} /></td>
                  <td className="pr-5">
                    <div className="flex justify-end gap-2">
                      {b.status === 0 && <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "hold", batch: b })}>Hold</Button>}
                      {b.status === 1 && <Button size="sm" onClick={() => setAction({ kind: "release", batch: b })} data-testid={`release-${b.id}`}>Release</Button>}
                      {b.status !== 2 && <Button size="sm" variant="danger" onClick={() => setAction({ kind: "recall", batch: b })}>Recall</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(action)} onClose={() => setAction(null)} title={action ? `${{ hold: "Put on hold", release: "Release", recall: "Recall" }[action.kind]}: ${action.batch.productName} (#${action.batch.id})` : ""}>
        {action && (
          <form className="space-y-4" onSubmit={submit}>
            {action.kind === "hold" && <Notice tone="warn">Shipping and dispensing stop until an admin releases the batch.</Notice>}
            {action.kind === "release" && <Notice tone="info">Only release after confirming product quality (e.g. lab stability test after a temperature excursion).</Notice>}
            {action.kind === "recall" && <Notice tone="danger" title="Permanent">Holders and affected patients are alerted; stock can only return to the manufacturer.</Notice>}
            {action.kind !== "hold" && (
              <Field label={action.kind === "release" ? "Review note (public)" : "Reason (public)"}>
                <Textarea required value={text} onChange={(e) => setText(e.target.value)} data-testid="admin-batch-note" />
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
              <Button type="submit" variant={action.kind === "recall" ? "danger" : "primary"} data-testid="admin-batch-confirm">Confirm</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

export function System({ me }) {
  const paused = usePaused();
  const { send } = useTx();
  const health = useApi("/api/health", { refetchInterval: 10000 });
  const relayer = useApi("/api/relayer", { refetchInterval: 30000 });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Emergency pause" subtitle="Stops batch creation, shipping, receiving and dispensing network-wide. Verification, recalls and quarantines keep working.">
        {paused.data ? (
          <Button onClick={() => send({ contract: trustChain, functionName: "unpause", label: "Resume network" })}>Resume network</Button>
        ) : (
          <Button variant="danger" onClick={() => send({ contract: trustChain, functionName: "pause", label: "Pause network" })}>Pause network</Button>
        )}
      </Card>
      <Card title="Deployment">
        <dl className="space-y-2 text-sm">
          <Row label="Chain">{chain.name} ({CHAIN_ID})</Row>
          <Row label="TrustChain"><Address address={trustChain.address} /></Row>
          <Row label="ColdChainMonitor"><Address address={coldChainMonitor.address} /></Row>
          <Row label="You">{me.isOwner ? "Owner" : "Admin"}</Row>
          <Row label="Backend">{health.data ? <Badge tone="ok">Online · block {health.data.indexedBlock}</Badge> : <Badge tone="danger">Offline</Badge>}</Row>
          <Row label="Relayer">{health.data?.relayer ? <Address address={health.data.relayer} /> : "—"}</Row>
          <Row label="Relayer gas">{relayer.data?.balance ? <span className={Number(relayer.data.balance) < 0.01 ? "text-rose-300" : ""}>{Number(relayer.data.balance).toFixed(4)} ETH</span> : "—"}</Row>
          <Row label="Pending box reports">{health.data?.pendingReports ?? "—"}</Row>
        </dl>
      </Card>
    </div>
  );
}

export function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
