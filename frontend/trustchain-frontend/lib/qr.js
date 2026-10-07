import { keccak256 } from "viem";

/** Strip QR payload: "TC1:0x<64 hex secret>". Also accepts the bare hex secret. */
export function parseStripCode(input) {
  const raw = String(input ?? "").trim();
  const m = raw.match(/^(?:TC1:)?(0x)?([0-9a-fA-F]{64})$/);
  return m ? `0x${m[2].toLowerCase()}` : null;
}

export const stripPayload = (secret) => `TC1:${secret}`;
export const codeHashOf = (secret) => keccak256(secret);

export function newSecret() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Strip secrets are generated in the browser; keep a local copy so labels can be (re)printed. */
const key = (chainId, batchId) => `trustchain:strips:${chainId}:${batchId}`;
export function saveStrips(chainId, batchId, secrets) {
  localStorage.setItem(key(chainId, batchId), JSON.stringify(secrets));
}
export function loadStrips(chainId, batchId) {
  try {
    return JSON.parse(localStorage.getItem(key(chainId, batchId)) ?? "[]");
  } catch {
    return [];
  }
}

/** Prescription QR: "TCRX:<id>" (or just the number). */
export const rxPayload = (id) => `TCRX:${id}`;
export function parseRx(input) {
  const m = String(input ?? "").trim().match(/^(?:TCRX:)?(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** Wallet QR: "ethereum:0x…[@chain]" or a bare address. */
export function parseWalletQr(input) {
  const m = String(input ?? "").trim().match(/(0x[0-9a-fA-F]{40})/);
  return m ? m[1] : null;
}
