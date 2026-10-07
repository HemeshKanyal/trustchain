"use client";
import { useState } from "react";
import { useChainId } from "wagmi";
import { useTx } from "@/lib/tx";
import { trustChain } from "@/lib/config";
import { codeHashOf, loadStrips, newSecret, saveStrips } from "@/lib/qr";

export const CHUNK = 200;

/** Generate secrets for a batch's unserialised strips and register their hashes, CHUNK per transaction. */
export function useSerialise() {
  const chainId = useChainId();
  const { send } = useTx();
  const [progress, setProgress] = useState(null); // {batchId, done, total}

  async function serialise(batch) {
    const existing = loadStrips(chainId, batch.id);
    const total = batch.quantity;
    let done = batch.stripsRegistered;
    setProgress({ batchId: batch.id, done, total });
    try {
      while (done < total) {
        const n = Math.min(CHUNK, total - done);
        const secrets = Array.from({ length: n }, newSecret);
        const ok = await send({
          contract: trustChain,
          functionName: "registerStrips",
          args: [BigInt(batch.id), secrets.map(codeHashOf)],
          label: `Register strip codes ${done + 1}–${done + n} of ${total}`,
          success: `${done + n} of ${total} strips serialised`,
        });
        if (!ok) return false;
        existing.push(...secrets);
        saveStrips(chainId, batch.id, existing);
        done += n;
        setProgress({ batchId: batch.id, done, total });
      }
      return true;
    } finally {
      setTimeout(() => setProgress(null), 400);
    }
  }

  return { serialise, progress };
}
