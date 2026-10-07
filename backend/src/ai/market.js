// Reference market data from the repo's sample sales dataset (data/medicines.csv.csv: 20k sales, 1–13 April 2023).
// Used only for reference prices and a starting demand level per medicine, never as a substitute for live data.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { priceStats, productKey } from "./prices.js";

const FILE = resolve(process.env.MARKET_DATA ?? new URL("../../../data/medicines.csv.csv", import.meta.url).pathname);

/** "04-01-2023 09:04" is month-day-year in this file (all rows fall in April 2023); "4/13/2023 14:09" too. */
function parseTime(s) {
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4}) (\d{1,2}):(\d{2})$/);
  return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) / 1000 : null;
}

function load() {
  if (!existsSync(FILE)) return { products: {}, days: 0, source: null };
  const rows = readFileSync(FILE, "utf8").trim().split("\n").slice(1);
  const by = {};
  let tmin = Infinity, tmax = -Infinity;
  for (const line of rows) {
    const [, time, , name, , price, , qty] = line.split(",");
    const t = parseTime(time);
    if (!t || !name) continue;
    tmin = Math.min(tmin, t);
    tmax = Math.max(tmax, t);
    const k = productKey(name);
    (by[k] ??= { name, prices: [], units: 0 }).prices.push(Number(price));
    by[k].units += Number(qty) || 0;
  }
  const days = Math.max(1, Math.round((tmax - tmin) / 86400) + 1);
  const products = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { name: v.name, price: priceStats(v.prices), dailyUnits: v.units / days }]));
  return { products, days, source: "sample sales dataset (20k sales, 1–13 April 2023)" };
}

export const market = load();
export const marketFor = (name) => market.products[productKey(name)] ?? null;
