"use client";
import { createConnector } from "wagmi";
import { getAddress, numberToHex } from "viem";

/**
 * Local-chain-only wallet for one of anvil's unlocked accounts.
 * Signing and sending are forwarded to anvil (which holds the keys); the connection survives reloads.
 */
export function devAccount({ address, label, rpcUrl }) {
  const account = getAddress(address);
  const flag = `trustchain:dev-connected:${account}`;
  let rpcId = 0;
  const rpc = async (method, params = []) => {
    const r = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data });
    return j.result;
  };

  return createConnector((config) => {
    const chainId = config.chains[0].id;
    const provider = {
      async request({ method, params }) {
        switch (method) {
          case "eth_accounts":
          case "eth_requestAccounts":
            return [account];
          case "eth_chainId":
            return numberToHex(chainId);
          case "wallet_switchEthereumChain":
          case "wallet_watchAsset":
            return null;
          case "personal_sign":
            return rpc("eth_sign", [account, params[0]]);
          default:
            return rpc(method, params);
        }
      },
      on() {},
      removeListener() {},
    };
    return {
      id: `dev-${account}`,
      name: label,
      type: "dev",
      async connect() {
        localStorage.setItem(flag, "1");
        return { accounts: [account], chainId };
      },
      async disconnect() {
        localStorage.removeItem(flag);
      },
      async getAccounts() {
        return [account];
      },
      async getChainId() {
        return chainId;
      },
      async getProvider() {
        return provider;
      },
      async isAuthorized() {
        return typeof localStorage !== "undefined" && localStorage.getItem(flag) === "1";
      },
      async switchChain() {
        return config.chains[0];
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {
        localStorage.removeItem(flag);
        config.emitter.emit("disconnect");
      },
    };
  });
}
