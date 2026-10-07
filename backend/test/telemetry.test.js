import { test } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { encodeDataHash, reportDomain, reportTypes, summarize, verifyTelemetry } from "../src/telemetry.js";

const ctx = { chainId: 31337, monitorAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" };
const device = privateKeyToAccount(generatePrivateKey());

async function makeBody(samples, rfid = [], overrides = {}, signer = device) {
  const report = {
    shipmentId: 3n, windowStart: 1790000000n, windowEnd: 1790000060n,
    ...summarize(samples), dataHash: encodeDataHash(samples, rfid), seq: 7n, ...overrides,
  };
  const signature = await signer.signTypedData({ domain: reportDomain(ctx.chainId, ctx.monitorAddress), types: reportTypes, primaryType: "Report", message: report });
  const plain = JSON.parse(JSON.stringify(report, (_, v) => (typeof v === "bigint" ? Number(v) : v)));
  return { device: device.address, report: plain, signature, samples, rfid };
}

const good = [[1790000010, 45, 500, 19076000, 72877700, 2], [1790000020, 52, 510, 19076100, 72877800, 2]];

test("accepts a valid device report", async () => {
  const { signer } = await verifyTelemetry(await makeBody(good, [[1790000015, "42a91505"]]), ctx);
  assert.equal(signer, device.address);
});

test("rejects samples altered after signing", async () => {
  const body = await makeBody(good);
  body.samples[1][1] = 50; // relayer tries to smooth a reading
  await assert.rejects(verifyTelemetry(body, ctx), /dataHash does not match/);
});

test("rejects a summary that hides an excursion", async () => {
  const hot = [[1790000010, 45, 500, 0, 0, 0], [1790000020, 412, 500, 0, 0, 0]];
  const body = await makeBody(hot, [], { maxTempX10: 60 });
  await assert.rejects(verifyTelemetry(body, ctx), /maxTempX10/);
});

test("rejects a lid-open window not flagged as tamper", async () => {
  const opened = [[1790000010, 45, 500, 0, 0, 1]];
  const body = await makeBody(opened, [], { tamper: false });
  await assert.rejects(verifyTelemetry(body, ctx), /tamper/);
});

test("rejects a report signed by another key", async () => {
  const body = await makeBody(good, [], {}, privateKeyToAccount(generatePrivateKey()));
  await assert.rejects(verifyTelemetry(body, ctx), (e) => e.status === 401);
});

test("rejects a report for another chain / contract", async () => {
  const body = await makeBody(good);
  await assert.rejects(verifyTelemetry(body, { ...ctx, chainId: 11155111 }), (e) => e.status === 401);
});

test("rejects malformed samples", async () => {
  const body = await makeBody(good);
  body.samples.push([1, 2, 3]);
  await assert.rejects(verifyTelemetry(body, ctx), (e) => e.status === 400);
});

test("window with no valid temperature counts as tamper", () => {
  assert.equal(summarize([[1, -32768, 65535, 0, 0, 0]]).tamper, true);
});
