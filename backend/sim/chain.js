// Wallets, gas funding, and one transaction queue per wallet (keeps nonces in order).
import { createTestClient, createWalletClient, formatEther, http, parseEther, parseEventLogs } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { chain, publicClient, trustChainAbi, monitorAbi } from "../src/chain.js";
import { config } from "../src/config.js";
import { sim } from "./config.js";

export const tc = { address: config.trustChain, abi: trustChainAbi };
export const mon = { address: config.monitor, abi: monitorAbi };
export { publicClient };
const local = config.chainId === 31337;
// simulateContract's return value is a prediction; with many wallets sending at once the real id comes from the receipt.
const ID_EVENTS = { createBatch: ["BatchCreated", "batchId"], createShipment: ["ShipmentCreated", "shipmentId"], issuePrescription: ["PrescriptionIssued", "prescriptionId"] };

export class Wallet {
  constructor(account, label, stats) {
    this.account = account;
    this.address = account.address;
    this.label = label;
    this.stats = stats;
    this.client = createWalletClient({ account, chain, transport: http(config.rpcUrl) });
    this.queue = Promise.resolve();
    this.session = null;
  }

  /** Simulate then send; resolves to { result, receipt } or throws the contract's error. Calls run one at a time. */
  send(contract, functionName, args) {
    const job = this.queue.then(async () => {
      const { request, result } = await publicClient.simulateContract({ ...contract, functionName, args, account: this.account });
      const hash = await this.client.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      this.stats.tx++;
      this.stats.gasWei = (BigInt(this.stats.gasWei) + receipt.gasUsed * receipt.effectiveGasPrice).toString();
      if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
      const idEvent = ID_EVENTS[functionName];
      if (idEvent) {
        const [log] = parseEventLogs({ abi: contract.abi, logs: receipt.logs, eventName: idEvent[0] });
        return { result: log.args[idEvent[1]], receipt };
      }
      return { result, receipt };
    });
    this.queue = job.catch(() => {});
    return job;
  }

  /** Backend session (same sign-in as the website), for private APIs like price reports. */
  async api(path, body, method = body ? "POST" : "GET") {
    if (!this.session || this.session.expires * 1000 < Date.now() + 60_000) {
      const post = (p, b) => fetch(`${sim.apiUrl}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
      const { message } = await post("/api/auth/challenge", { address: this.address });
      this.session = await post("/api/auth/login", { address: this.address, message, signature: await this.account.signMessage({ message }) });
    }
    const r = await fetch(`${sim.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.session.token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path}: ${out.error ?? r.status}`);
    return out;
  }
}

export function walletsFrom(mnemonic, stats) {
  const at = (i, label) => new Wallet(mnemonicToAccount(mnemonic, { addressIndex: i }), label, stats);
  return { at, account: (i) => mnemonicToAccount(mnemonic, { addressIndex: i }) };
}

/** Make sure every simulated wallet can pay gas: free on anvil, from the funder wallet elsewhere. */
export async function fund(wallets, log) {
  if (local) {
    const test = createTestClient({ chain, mode: "anvil", transport: http(config.rpcUrl) });
    // Boxes sign wall-clock times (like real devices); a local chain left in the past by the demo seeder catches up.
    const lag = Math.floor(Date.now() / 1000) - Number((await publicClient.getBlock()).timestamp);
    if (lag > 5) {
      await test.setNextBlockTimestamp({ timestamp: BigInt(Math.floor(Date.now() / 1000)) });
      await test.mine({ blocks: 1 });
      log(`local chain clock moved forward ${Math.round(lag / 3600)} h to the present`);
    }
    for (const w of wallets) {
      const bal = await publicClient.getBalance({ address: w.address });
      if (bal < parseEther("1")) await test.setBalance({ address: w.address, value: parseEther("100") });
    }
    return;
  }
  if (!sim.funderKey) throw new Error("Set SIM_FUNDER_KEY (a wallet you topped up from a Sepolia faucet) so the simulator can pay gas.");
  const funder = createWalletClient({ account: privateKeyToAccount(sim.funderKey), chain, transport: http(config.rpcUrl) });
  for (const w of wallets) {
    const bal = await publicClient.getBalance({ address: w.address });
    if (bal >= parseEther(String(sim.minBalanceEth))) continue;
    const hash = await funder.sendTransaction({ to: w.address, value: parseEther(String(sim.topUpEth)) });
    await publicClient.waitForTransactionReceipt({ hash });
    log(`funded ${w.label} with ${sim.topUpEth} ETH`);
  }
  const left = await publicClient.getBalance({ address: funder.account.address });
  log(`funder ${funder.account.address} has ${formatEther(left)} ETH left`);
}
