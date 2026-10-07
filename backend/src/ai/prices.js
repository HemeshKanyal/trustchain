// Market reference prices and "price far from market" detection.

// Local names → the names used in the reference dataset.
const SYNONYMS = { paracetamol: "acetaminophen", salbutamol: "albuterol", frusemide: "furosemide", glibenclamide: "glyburide" };

/** "Amoxicillin 500mg capsules" → "amoxicillin" (the active ingredient is what prices are compared on). */
export const productKey = (name) => {
  const k = String(name ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").trim().split(/\s+/)[0] ?? "";
  return SYNONYMS[k] ?? k;
};

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function priceStats(prices) {
  const s = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  return { n: s.length, median: quantile(s, 0.5), p25: quantile(s, 0.25), p75: quantile(s, 0.75) };
}

/** Finding for one observed price against market stats, or null if it's within the normal range. */
export function priceFinding(price, stats, where = "") {
  if (!stats?.median || stats.n < 3 || !(price > 0)) return null;
  const ratio = price / stats.median;
  const pct = Math.round(Math.abs(1 - ratio) * 100);
  const ctx = where ? ` ${where}` : "";
  if (ratio < 0.5)
    return {
      code: "PRICE_LOW",
      severity: ratio < 0.3 ? "critical" : "warning",
      text: `Resale price far below market: ₹${price} is ${pct}% under the ₹${Math.round(stats.median)} median${ctx}.`,
      weight: ratio < 0.3 ? 25 : 15,
      ratio,
    };
  if (ratio > 2)
    return { code: "PRICE_HIGH", severity: "warning", text: `Price far above market: ₹${price} is ${pct}% over the ₹${Math.round(stats.median)} median${ctx}.`, weight: 8, ratio };
  return null;
}
