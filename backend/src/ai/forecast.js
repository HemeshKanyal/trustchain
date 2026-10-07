// Daily demand forecasting: additive Holt-Winters with weekly seasonality, parameters chosen by grid search
// on one-step-ahead error; falls back to exponential smoothing for short histories.

const DAY = 86400;
export const dayIndex = (unix) => Math.floor(unix / DAY);

/** events: [{ t: unix, qty }] → contiguous daily totals from first event day to `untilDay` (inclusive). */
export function dailySeries(events, untilDay = null) {
  if (!events.length) return { start: null, values: [] };
  const days = events.map((e) => dayIndex(e.t));
  const start = Math.min(...days);
  const end = Math.max(untilDay ?? -Infinity, ...days);
  const values = new Array(end - start + 1).fill(0);
  events.forEach((e, i) => (values[days[i] - start] += e.qty ?? 1));
  return { start, values };
}

// Damped trend (Gardner & McKenzie): the trend fades instead of extrapolating forever, so a temporary dip
// (a stock-out, a holiday) doesn't forecast demand collapsing to zero.
function hw(y, m, a, b, g, phi) {
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  let L = mean(y.slice(0, m));
  let T = (mean(y.slice(m, 2 * m)) - L) / m;
  const S = y.slice(0, m).map((v) => v - L);
  let sse = 0;
  const resid = [];
  for (let t = 0; t < y.length; t++) {
    const s = S[t % m];
    const f = L + phi * T + s;
    if (t >= m) {
      sse += (y[t] - f) ** 2;
      resid.push(y[t] - f);
    }
    const prevL = L;
    L = a * (y[t] - s) + (1 - a) * (L + phi * T);
    T = b * (L - prevL) + (1 - b) * phi * T;
    S[t % m] = g * (y[t] - L) + (1 - g) * s;
  }
  return { L, T, S, sse, resid, n: y.length, phi };
}

function ses(y, a = 0.3) {
  let L = y[0];
  const resid = [];
  for (let t = 1; t < y.length; t++) {
    resid.push(y[t] - L);
    L = a * y[t] + (1 - a) * L;
  }
  return { L, resid };
}

const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

/** Forecast `h` days. Returns { method, points: [{ day, mean, lo, hi }] } (80% band), never negative. */
export function forecast(values, h = 14, m = 7) {
  const y = values.map(Number);
  const out = (method, mean, sigma, alpha) => ({
    method,
    points: Array.from({ length: h }, (_, k) => {
      const mu = Math.max(0, mean(k + 1));
      const band = 1.28 * sigma * Math.sqrt(1 + k * alpha * alpha);
      return { step: k + 1, mean: mu, lo: Math.max(0, mu - band), hi: mu + band };
    }),
  });
  if (y.length === 0) return out("none", () => 0, 0, 0);
  if (y.length < 3) {
    const avg = y.reduce((s, x) => s + x, 0) / y.length;
    return out("average", () => avg, avg * 0.5, 0);
  }
  if (y.length < 2 * m + 2) {
    const s = ses(y);
    return out("exponential smoothing", () => s.L, sd(s.resid), 0.3);
  }
  let best = null;
  for (const a of [0.05, 0.1, 0.2, 0.3, 0.5])
    for (const b of [0, 0.02, 0.05, 0.1])
      for (const g of [0.05, 0.1, 0.2, 0.4])
        for (const phi of [0.8, 0.9, 0.98]) {
          const fit = hw(y, m, a, b, g, phi);
          if (!best || fit.sse < best.fit.sse) best = { fit, a };
        }
  const { L, T, S, resid, n, phi } = best.fit;
  const damp = (k) => (phi === 1 ? k : (phi * (1 - phi ** k)) / (1 - phi));
  return out("Holt-Winters (weekly)", (k) => L + damp(k) * T + S[(n + k - 1) % m], sd(resid), best.a);
}

/** Hold out the last `h` days, forecast them, and report WAPE (sum|error| / sum actual) and bias. */
export function backtest(values, h = 14, m = 7) {
  if (values.length < h + 2 * m + 2) return null;
  const train = values.slice(0, -h);
  const test = values.slice(-h);
  const f = forecast(train, h, m).points.map((p) => p.mean);
  const absErr = test.reduce((s, v, i) => s + Math.abs(v - f[i]), 0);
  const total = test.reduce((s, v) => s + v, 0);
  return {
    horizon: h,
    wape: total ? absErr / total : null,
    bias: total ? (f.reduce((s, v) => s + v, 0) - total) / total : null,
    actual: total,
    predicted: Math.round(f.reduce((s, v) => s + v, 0)),
  };
}

/** Days until forecast demand uses up `stock` (Infinity if it doesn't within the horizon). */
export function daysOfCover(stock, points) {
  let left = stock;
  for (const p of points) {
    left -= p.mean;
    if (left < 0) return p.step - 1 + (left + p.mean) / p.mean;
  }
  return Infinity;
}
