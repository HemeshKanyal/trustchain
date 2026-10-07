"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { API_URL, CHAIN_ID } from "./config";
import { nowSec } from "./format";

/** Wallet sign-in session with the backend (12 h). One signature, no transaction. */
const KEY = `trustchain:session:${CHAIN_ID}`;
const EVENT = "trustchain-session";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function sessionToken(address) {
  const s = read();
  if (!s || !address || s.address.toLowerCase() !== address.toLowerCase() || s.expires * 1000 < Date.now()) return null;
  return s.token;
}

export async function authedFetch(path, address, init = {}) {
  const token = sessionToken(address);
  const r = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  if (!r.ok) {
    const msg = (await r.json().catch(() => null))?.error ?? `Request failed (${r.status})`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return r.headers.get("content-type")?.includes("json") ? r.json() : r.blob();
}

export function useSession() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [s, setS] = useState(null);

  useEffect(() => {
    const sync = () => setS(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const valid = Boolean(s && address && s.address.toLowerCase() === address.toLowerCase() && s.expires > nowSec());

  const signIn = useCallback(async () => {
    if (!walletClient || !address) throw new Error("Connect a wallet first.");
    const post = (p, body) =>
      fetch(`${API_URL}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `Sign-in failed (${r.status})`);
        return j;
      });
    const { message } = await post("/api/auth/challenge", { address });
    const signature = await walletClient.signMessage({ account: address, message });
    const session = await post("/api/auth/login", { address, message, signature });
    localStorage.setItem(KEY, JSON.stringify(session));
    window.dispatchEvent(new Event(EVENT));
    return session;
  }, [walletClient, address]);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { session: valid ? s : null, valid, signIn, signOut, address };
}
