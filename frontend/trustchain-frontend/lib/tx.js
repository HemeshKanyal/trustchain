"use client";
import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useTxSheet } from "@/components/TxSheet";
import { humanError } from "./errors";

/** Simulate → sign → wait, shown step by step in the transaction sheet. Returns {receipt, result} or null. */
export function useTx() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const qc = useQueryClient();
  const sheet = useTxSheet();
  const [pending, setPending] = useState(null);

  async function send({ contract, functionName, args = [], label, success }) {
    setPending(functionName);
    sheet.update({ label, step: "check", error: null, hash: null, success });
    try {
      if (!walletClient) throw new Error("Connect a wallet first.");
      const { request, result } = await publicClient.simulateContract({ ...contract, functionName, args, account: address });
      sheet.update({ step: "sign" });
      const hash = await walletClient.writeContract(request);
      sheet.update({ step: "seal", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      sheet.update({ step: "done" });
      await qc.invalidateQueries();
      return { receipt, result };
    } catch (e) {
      sheet.update({ step: "error", error: humanError(e) });
      return null;
    } finally {
      setPending(null);
    }
  }

  return { send, pending };
}
