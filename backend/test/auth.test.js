import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { issueChallenge, login, sessionAddress } from "../src/auth.js";
import { seal, open } from "../src/vault.js";

const reqWith = (token) => ({ get: (h) => (h.toLowerCase() === "authorization" && token ? `Bearer ${token}` : undefined) });

test("wallet sign-in issues a token that identifies the wallet", async () => {
  const acct = privateKeyToAccount(generatePrivateKey());
  const { message } = issueChallenge(acct.address);
  const signature = await acct.signMessage({ message });
  const { token, address } = await login({ address: acct.address, message, signature });
  assert.equal(address, acct.address);
  assert.equal(sessionAddress(reqWith(token)), acct.address);
});

test("a challenge can only be used once", async () => {
  const acct = privateKeyToAccount(generatePrivateKey());
  const { message } = issueChallenge(acct.address);
  const signature = await acct.signMessage({ message });
  await login({ address: acct.address, message, signature });
  await assert.rejects(login({ address: acct.address, message, signature }), /expired/);
});

test("someone else's signature is rejected", async () => {
  const victim = privateKeyToAccount(generatePrivateKey());
  const attacker = privateKeyToAccount(generatePrivateKey());
  const { message } = issueChallenge(victim.address);
  const signature = await attacker.signMessage({ message });
  await assert.rejects(login({ address: victim.address, message, signature }), /does not match/);
});

test("a tampered token is rejected", async () => {
  const acct = privateKeyToAccount(generatePrivateKey());
  const other = privateKeyToAccount(generatePrivateKey());
  const { message } = issueChallenge(acct.address);
  const { token } = await login({ address: acct.address, message, signature: await acct.signMessage({ message }) });
  const [, mac] = token.split(".");
  const forged = `${Buffer.from(`${other.address}.${Math.floor(Date.now() / 1000) + 3600}`).toString("base64url")}.${mac}`;
  assert.equal(sessionAddress(reqWith(forged)), null);
  assert.equal(sessionAddress(reqWith(null)), null);
});

test("prescription details are encrypted and decrypt intact", () => {
  const text = "Amoxicillin 500mg, 1 tablet three times daily for 5 days";
  const box = seal(text);
  assert.ok(!box.ct.includes("Amoxicillin"));
  assert.equal(open(box), text);
  const tampered = { ...box, ct: Buffer.from("x".repeat(20)).toString("base64") };
  assert.throws(() => open(tampered));
});
