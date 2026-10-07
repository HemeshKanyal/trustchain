// AES-256-GCM encryption for off-chain private data (prescription details).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { DATA_KEY } from "./secrets.js";

export function seal(plaintext) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", DATA_KEY, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

export function open({ iv, tag, ct }) {
  const d = createDecipheriv("aes-256-gcm", DATA_KEY, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
