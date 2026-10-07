// Packaging-scan intelligence from anonymous Verify-page scans.

const DAY = 86400;

/**
 * Copied QR codes: a strip scanned after it was sold by several *different* visitors is likely a cloned code
 * printed on fake packs. scans: [{ code_hash, verdict, visitor, created_at }], soldAt: Map(codeHash → unix).
 */
export function cloneSignals(scans, soldAt, { minVisitors = 3, windowDays = 60 } = {}) {
  const byCode = new Map();
  for (const s of scans) {
    const sold = soldAt.get(s.code_hash);
    if (!sold || s.created_at < sold || s.created_at > sold + windowDays * DAY) continue;
    if (!byCode.has(s.code_hash)) byCode.set(s.code_hash, new Set());
    byCode.get(s.code_hash).add(s.visitor);
  }
  return [...byCode.entries()].filter(([, v]) => v.size >= minVisitors).map(([code, v]) => ({ codeHash: code, visitors: v.size }));
}

/** Days where scans of unregistered codes jump well above their usual level (a counterfeit wave). */
export function unknownBursts(scans, { now = Math.floor(Date.now() / 1000), days = 30 } = {}) {
  const counts = new Array(days).fill(0);
  for (const s of scans) {
    if (s.verdict !== "unknown") continue;
    const ago = Math.floor((now - s.created_at) / DAY);
    if (ago >= 0 && ago < days) counts[days - 1 - ago]++;
  }
  const base = counts.slice(0, -1);
  const mean = base.reduce((a, b) => a + b, 0) / Math.max(1, base.length);
  const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, base.length));
  const today = counts.at(-1);
  return { counts, today, mean, burst: today >= 3 && today > mean + 3 * Math.max(sd, 0.5) };
}
