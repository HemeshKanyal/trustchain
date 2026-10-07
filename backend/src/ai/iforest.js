// Isolation Forest (Liu, Ting & Zhou 2008): anomalies are isolated by fewer random splits.
// Deterministic (seeded) so the same data always gives the same scores.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average unsuccessful-search path length in a BST of n points: normalises tree depth. */
export const c = (n) => (n <= 1 ? 0 : n === 2 ? 1 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n);

function build(rows, depth, limit, rand) {
  if (depth >= limit || rows.length <= 1) return { size: rows.length };
  const dims = rows[0].length;
  const usable = [];
  for (let d = 0; d < dims; d++) {
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) {
      if (r[d] < lo) lo = r[d];
      if (r[d] > hi) hi = r[d];
    }
    if (hi > lo) usable.push([d, lo, hi]);
  }
  if (!usable.length) return { size: rows.length };
  const [d, lo, hi] = usable[Math.floor(rand() * usable.length)];
  const split = lo + rand() * (hi - lo);
  const left = rows.filter((r) => r[d] < split);
  const right = rows.filter((r) => r[d] >= split);
  return { d, split, left: build(left, depth + 1, limit, rand), right: build(right, depth + 1, limit, rand) };
}

function pathLength(x, node, depth = 0) {
  if (node.size != null) return depth + c(node.size);
  return pathLength(x, x[node.d] < node.split ? node.left : node.right, depth + 1);
}

/** Fit on rows (array of numeric arrays); returns score(x) in (0,1): ~0.5 normal, > ~0.62 unusual. */
export function isolationForest(rows, { trees = 150, sampleSize = 256, seed = 42 } = {}) {
  const rand = rng(seed);
  const psi = Math.min(sampleSize, rows.length);
  const limit = Math.ceil(Math.log2(Math.max(2, psi)));
  const forest = [];
  for (let t = 0; t < trees; t++) {
    const sample = [];
    for (let i = 0; i < psi; i++) sample.push(rows[Math.floor(rand() * rows.length)]);
    forest.push(build(sample, 0, limit, rand));
  }
  const norm = c(psi);
  return (x) => 2 ** (-(forest.reduce((a, tree) => a + pathLength(x, tree), 0) / forest.length) / (norm || 1));
}
