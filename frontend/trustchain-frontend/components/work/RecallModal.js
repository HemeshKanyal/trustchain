"use client";
import { useState } from "react";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { Button, Field, Input, Modal, Notice, Textarea } from "../ui";

export default function RecallModal({ batch, onClose }) {
  const { send, pending } = useTx();
  const [reason, setReason] = useState("");
  const [lot, setLot] = useState("");
  if (!batch) return null;
  return (
    <Modal open onClose={onClose} title={`Recall ${batch.productName} (batch #${batch.id})`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send({ contract: trustChain, functionName: "recallBatch", args: [BigInt(batch.id), reason], label: `Recall batch #${batch.id}`, success: "Recalled. Holders and affected patients are being alerted." });
          if (ok) onClose();
        }}
      >
        <Notice tone="danger" title="This is permanent">
          Sale and onward shipping stop immediately everywhere. Pharmacies and patients holding this batch are alerted. Stock can only come back to you.
        </Notice>
        <Field label="Reason (public)">
          <Textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Impurity above limit in stability test" data-testid="recall-reason" />
        </Field>
        <Field label={`Type the lot number (${batch.lotNumber}) to confirm`}>
          <Input value={lot} onChange={(e) => setLot(e.target.value)} className="font-mono" data-testid="recall-lot" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={lot.trim() !== batch.lotNumber} loading={pending === "recallBatch"} data-testid="recall-submit">
            Recall batch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
