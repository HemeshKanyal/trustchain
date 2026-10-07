// Submits stored device reports to ColdChainMonitor, one at a time (keeps nonces simple).
import { BaseError, ContractFunctionRevertedError, decodeEventLog } from "viem";
import { config } from "./config.js";
import { db } from "./db.js";
import { monitorAbi, publicClient, relayerAccount, walletClient } from "./chain.js";

const MAX_ATTEMPTS = 10;
const nextPending = db.prepare("SELECT * FROM reports WHERE status = 'pending' ORDER BY id LIMIT 1");
const update = db.prepare("UPDATE reports SET status = ?, error = ?, tx_hash = ?, breach_flags = ?, attempts = attempts + ? WHERE id = ?");

export function rowToReport(r) {
  return {
    shipmentId: BigInt(r.shipment_id),
    windowStart: BigInt(r.window_start),
    windowEnd: BigInt(r.window_end),
    readings: r.readings,
    minTempX10: r.min_temp_x10,
    maxTempX10: r.max_temp_x10,
    maxHumidityX10: r.max_humidity_x10,
    latE6: r.lat_e6,
    lonE6: r.lon_e6,
    tamper: Boolean(r.tamper),
    dataHash: r.data_hash,
    seq: BigInt(r.seq),
  };
}

async function relayOne() {
  const row = nextPending.get();
  if (!row) return false;
  const args = [rowToReport(row), row.signature];

  let request;
  try {
    ({ request } = await publicClient.simulateContract({
      address: config.monitor,
      abi: monitorAbi,
      functionName: "submitReport",
      args,
      account: relayerAccount,
    }));
  } catch (e) {
    const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    if (revert) {
      const reason = revert.data?.errorName ?? revert.shortMessage;
      update.run("rejected", reason, null, null, 1, row.id);
      console.warn(`[relayer] report ${row.id} (shipment ${row.shipment_id} seq ${row.seq}) rejected: ${reason}`);
    } else {
      const status = row.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending";
      update.run(status, e.shortMessage ?? e.message, null, null, 1, row.id);
      console.warn(`[relayer] report ${row.id} RPC error (attempt ${row.attempts + 1}): ${e.shortMessage ?? e.message}`);
    }
    return false;
  }

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  let flags = 0;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: monitorAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "BreachDetected") flags = Number(ev.args.reasonFlags);
    } catch {
      // not a monitor event
    }
  }
  const ok = receipt.status === "success";
  update.run(ok ? "confirmed" : "failed", ok ? null : "tx reverted", hash, flags, 1, row.id);
  console.log(`[relayer] report ${row.id} shipment ${row.shipment_id} seq ${row.seq} -> ${hash}${flags ? ` BREACH flags=${flags}` : ""}`);
  return true;
}

export function startRelayer() {
  if (!walletClient) {
    console.warn("[relayer] RELAYER_PRIVATE_KEY not set: reports are stored but NOT submitted on-chain");
    return;
  }
  console.log(`[relayer] submitting as ${relayerAccount.address}`);
  const loop = async () => {
    let busy = false;
    try {
      busy = await relayOne();
    } catch (e) {
      console.error("[relayer]", e.shortMessage ?? e.message);
    }
    setTimeout(loop, busy ? 200 : 2000);
  };
  loop();
}
