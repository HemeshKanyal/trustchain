// Wallet sign-in: the client signs a one-time message; the server returns an HMAC session token.
// Roles are never stored in the token: every protected route re-checks the address on-chain.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";
import { config } from "./config.js";
import { SESSION_SECRET } from "./secrets.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_S = 12 * 60 * 60;
const nonces = new Map(); // address -> { nonce, message, expires }

export function signInMessage(address, nonce, issuedAt) {
  return [
    "TrustChain wants you to sign in with your wallet.",
    "",
    `Address: ${address}`,
    `Chain ID: ${config.chainId}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
    "",
    "Signing proves you control this wallet. It costs nothing and sends no transaction.",
  ].join("\n");
}

export function issueChallenge(rawAddress) {
  if (!isAddress(rawAddress, { strict: false })) throw Object.assign(new Error("invalid address"), { status: 400 });
  const address = getAddress(rawAddress);
  const nonce = randomBytes(12).toString("hex");
  const message = signInMessage(address, nonce, new Date().toISOString());
  nonces.set(address, { message, expires: Date.now() + NONCE_TTL_MS });
  return { address, message };
}

const sign = (payload) => createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");

export async function login({ address: rawAddress, message, signature }) {
  const fail = (m, s = 401) => {
    throw Object.assign(new Error(m), { status: s });
  };
  if (!isAddress(rawAddress ?? "", { strict: false }) || typeof message !== "string" || typeof signature !== "string") fail("bad request", 400);
  const address = getAddress(rawAddress);
  const pending = nonces.get(address);
  if (!pending || pending.expires < Date.now() || pending.message !== message) fail("sign-in request expired; try again");
  const ok = await verifyMessage({ address, message, signature });
  if (!ok) fail("signature does not match this wallet");
  nonces.delete(address);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const payload = `${address}.${exp}`;
  return { address, token: `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`, expires: exp };
}

/** Returns the checksummed address of a valid session, or null. */
export function sessionAddress(req) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const [p64, mac] = token.split(".");
  if (!p64 || !mac) return null;
  const payload = Buffer.from(p64, "base64url").toString();
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const [address, exp] = payload.split(".");
  if (!isAddress(address) || Number(exp) < Date.now() / 1000) return null;
  return address;
}

export function requireSession(req) {
  const a = sessionAddress(req);
  if (!a) throw Object.assign(new Error("sign in first"), { status: 401 });
  return a;
}
