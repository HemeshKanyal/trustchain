// Server-side secrets, generated once and kept in data/keys.json (git-ignored with data/).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.js";

const file = join(dirname(config.dbPath), "keys.json");
mkdirSync(dirname(file), { recursive: true });

function load() {
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const keys = { sessionSecret: randomBytes(32).toString("hex"), dataKey: randomBytes(32).toString("hex") };
  writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
  return keys;
}

const keys = load();
export const SESSION_SECRET = Buffer.from(process.env.SESSION_SECRET ?? keys.sessionSecret, "hex");
export const DATA_KEY = Buffer.from(process.env.DATA_KEY ?? keys.dataKey, "hex");
