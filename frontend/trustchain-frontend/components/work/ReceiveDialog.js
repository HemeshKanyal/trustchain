"use client";
import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { authedFetch } from "@/lib/session";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { codeHashOf, parseStripCode } from "@/lib/qr";
import QrScanner from "../QrScanner";
import { BoxStatus } from "../ShipmentTable";
import { Button, Input, Modal, Notice } from "../ui";

/** Confirm a delivery. If the batch is serialised, one strip from the box must be scanned first (proof it arrived). */
export default function ReceiveDialog({ shipment, onClose }) {
  const client = usePublicClient();
  const { address } = useAccount();
  const record = (foundBatchId) =>
    authedFetch("/api/receive-checks", address, { method: "POST", body: JSON.stringify({ shipmentId: shipment.id, foundBatchId }) }).catch(() => {});
  const { send, pending } = useTx();
  const [code, setCode] = useState("");
  const [proof, setProof] = useState(null); // {ok, message}
  const needsProof = (shipment?.batch?.stripsRegistered ?? 0) > 0;

  async function check(text) {
    const secret = parseStripCode(text);
    if (!secret) return setProof({ ok: false, message: "Not a TrustChain strip code." });
    const strip = await client.readContract({ ...trustChain, functionName: "getStrip", args: [codeHashOf(secret)] });
    if (Number(strip.status) === 0) {
      record(null);
      return setProof({ ok: false, message: "Unknown code: this strip is not registered. Do not accept the box." });
    }
    record(Number(strip.batchId));
    if (Number(strip.batchId) !== shipment.batchId) return setProof({ ok: false, message: `This strip is from batch #${strip.batchId}, not #${shipment.batchId}. Contents may have been swapped.` });
    setProof({ ok: true, message: `Strip matches batch #${shipment.batchId}.` });
  }

  if (!shipment) return null;
  return (
    <Modal open onClose={onClose} title={`Receive shipment #${shipment.id}`}>
      <div className="space-y-4" data-testid="receive-dialog">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <div>
            <div className="font-medium text-white">{shipment.batch?.productName}</div>
            <div className="text-xs text-slate-400">{shipment.quantity} strips · batch #{shipment.batchId}</div>
          </div>
          {shipment.device !== "0x0000000000000000000000000000000000000000" && <BoxStatus shipmentId={shipment.id} />}
        </div>
        {needsProof ? (
          <>
            <p className="text-sm text-slate-300">Open the box and scan any one strip to prove these are the right goods.</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                check(code);
              }}
            >
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TC1:0x…" className="font-mono" aria-label="Strip code" data-testid="receive-code" />
              <Button type="submit" variant="secondary" data-testid="receive-check">Check</Button>
              <QrScanner onResult={check} label="Scan" />
            </form>
            {proof && <Notice tone={proof.ok ? "ok" : "danger"}>{proof.message}</Notice>}
          </>
        ) : (
          <Notice tone="info">This batch has no serialised strips, so no scan is needed.</Notice>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              const ok = await send({ contract: trustChain, functionName: "cancelShipment", args: [BigInt(shipment.id)], label: `Reject shipment #${shipment.id}`, success: "Rejected. Stock returned to the sender." });
              if (ok) onClose();
            }}
          >
            Reject
          </Button>
          <Button
            disabled={needsProof && !proof?.ok}
            loading={pending === "receiveShipment"}
            data-testid="receive-confirm"
            onClick={async () => {
              const ok = await send({ contract: trustChain, functionName: "receiveShipment", args: [BigInt(shipment.id)], label: `Receive shipment #${shipment.id}`, success: "Received. Custody is now yours on-chain." });
              if (ok) onClose();
            }}
          >
            <PackageCheck className="h-4 w-4" /> Confirm receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
