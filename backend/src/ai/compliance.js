// Organisation compliance score: 100 minus penalties for rule breaches, with the reasons.

const RULES = {
  UNMONITORED_COLD: { penalty: 15, text: (n) => `${n} cold-chain shipment${n > 1 ? "s" : ""} sent without a smart box` },
  BREACH_SENT: { penalty: 10, text: (n) => `${n} shipment${n > 1 ? "s" : ""} with a cold-chain breach on their watch` },
  SLOW_RECEIPT: { penalty: 5, text: (n) => `${n} delivery${n > 1 ? "ies" : ""} left unconfirmed for over 72 h` },
  RECALLED_STOCK_HELD: { penalty: 15, text: (n) => `Still holding ${n} strip${n > 1 ? "s" : ""} of recalled batches (return them to the manufacturer)` },
  NEAR_EXPIRY_SALES: { penalty: 3, text: (n) => `${n} strip${n > 1 ? "s" : ""} sold within 7 days of expiry` },
  PRICE_ANOMALY: { penalty: 8, text: (n) => `${n} sale${n > 1 ? "s" : ""} priced far from market` },
  RECEIVE_MISMATCH: { penalty: 20, text: (n) => `${n} delivery check${n > 1 ? "s" : ""} found strips from the wrong batch` },
  OPEN_QUARANTINE: { penalty: 5, text: (n) => `${n} batch${n > 1 ? "es" : ""} on hold for over 7 days without a decision` },
};

/** facts: { [ruleCode]: count } → { score, grade, issues: [{ code, count, penalty, text }] } */
export function complianceScore(facts) {
  const issues = Object.entries(facts)
    .filter(([code, n]) => RULES[code] && n > 0)
    .map(([code, n]) => {
      const r = RULES[code];
      const penalty = Math.min(40, r.penalty * n);
      return { code, count: n, penalty, text: r.text(n) };
    })
    .sort((a, b) => b.penalty - a.penalty);
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.penalty, 0));
  return { score, grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : "D", issues };
}
