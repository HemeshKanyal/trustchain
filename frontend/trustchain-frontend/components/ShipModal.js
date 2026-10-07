"use client";
import { useMemo, useState } from "react";
import { useDevices, useParticipants } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { ROLES, isExpired, short, ZERO } from "@/lib/format";
import { Button, Field, Input, Modal, Notice, Select } from "./ui";

/** Allowed recipients mirror TrustChain._checkRoute. */
function allowedRecipients(myRole, me, batch, participants) {
  const unusable = batch.status !== 0 || isExpired(batch.expiresAt);
  return participants.filter((p) => {
    if (!p.active || p.address.toLowerCase() === me.toLowerCase()) return false;
    const isMaker = p.address.toLowerCase() === batch.manufacturer.toLowerCase();
    if (unusable) return isMaker && myRole !== 2;
    if (isMaker && myRole !== 2) return true;
    if (myRole === 2) return p.role === 3;
    if (myRole === 3) return p.role === 3 || p.role === 4;
    if (myRole === 4) return p.role === 3;
    return false;
  });
}

export default function ShipModal({ open, onClose, me, myRole, batch, balance }) {
  const { data: participants = [] } = useParticipants();
  const { data: devices = [] } = useDevices();
  const { send, pending } = useTx();
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [device, setDevice] = useState("");
  const recipients = useMemo(() => (batch ? allowedRecipients(myRole, me, batch, participants) : []), [batch, participants, me, myRole]);
  if (!batch) return null;
  const isReturn = batch.status !== 0 || isExpired(batch.expiresAt);

  async function submit(e) {
    e.preventDefault();
    const ok = await send({
      contract: trustChain,
      functionName: "createShipment",
      args: [BigInt(batch.id), to, Number(qty), device || ZERO],
      label: `Ship ${qty} × ${batch.productName}`,
      success: "Shipment created. The recipient must confirm receipt.",
    });
    if (ok) {
      setQty("");
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${isReturn ? "Return" : "Ship"} ${batch.productName} (batch #${batch.id})`}>
      <form className="space-y-4" onSubmit={submit}>
        {isReturn && (
          <Notice tone="warn" title="This batch can only go back to its manufacturer">
            It is recalled, quarantined or expired, so onward shipping is blocked on-chain.
          </Notice>
        )}
        <Field label="Recipient">
          <Select required value={to} onChange={(e) => setTo(e.target.value)} data-testid="ship-to">
            <option value="">Choose…</option>
            {recipients.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name} ({ROLES[p.role]}, {short(p.address)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity (strips)" hint={`You hold ${balance}.`}>
          <Input required type="number" min={1} max={balance} value={qty} onChange={(e) => setQty(e.target.value)} data-testid="ship-qty" />
        </Field>
        <Field label="Smart box (IoT tracker)" hint="The box signs temperature, humidity, GPS and lid status for this shipment.">
          <Select value={device} onChange={(e) => setDevice(e.target.value)} data-testid="ship-device">
            <option value="">No smart box</option>
            {devices
              .filter((d) => d.active)
              .map((d) => (
                <option key={d.address} value={d.address}>
                  {d.label} ({short(d.address)})
                </option>
              ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending === "createShipment"} data-testid="ship-submit">
            {isReturn ? "Return stock" : "Create shipment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
