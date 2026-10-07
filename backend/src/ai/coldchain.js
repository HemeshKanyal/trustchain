// Cold-chain analysis of one smart-box trip, in the terms pharma quality teams use.

/** ΔH/R for the mean kinetic temperature, in kelvin (ΔH = 83.144 kJ/mol, the ICH/USP default). */
const DH_R = 10000;
const K = 273.15;

/**
 * Time-weighted mean kinetic temperature (°C). MKT weights hot periods more than a plain average,
 * because degradation speeds up exponentially with temperature (Arrhenius).
 * points: [{ t: unix seconds, c: °C }], sorted.
 */
export function meanKineticTemperature(points, maxStepSeconds = Infinity) {
  if (!points.length) return null;
  if (points.length === 1) return points[0].c;
  let num = 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[i + 1]?.t ?? points[i].t + Math.min(maxStepSeconds, points[i].t - points[i - 1].t);
    const w = Math.max(0, Math.min(maxStepSeconds, next - points[i].t));
    num += w * Math.exp(-DH_R / (points[i].c + K));
    total += w;
  }
  if (!total) return points.reduce((a, p) => a + p.c, 0) / points.length;
  return DH_R / -Math.log(num / total) - K;
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const minutes = (s) => Math.round(s / 60);

/**
 * samples: [{ t, temp_x10|null, humidity_x10|null, flags }] (backend `samples` rows), any order.
 * conditions: { minTempX10, maxTempX10, maxHumidityX10 }.
 * Returns metrics plus `findings` [{ code, severity: 'critical'|'warning'|'info', text, weight }].
 */
export function analyzeTrip(samples, conditions) {
  const rows = [...samples].sort((a, b) => a.t - b.t);
  const lo = Number(conditions.minTempX10) / 10;
  const hi = Number(conditions.maxTempX10) / 10;
  const maxHum = Number(conditions.maxHumidityX10) ? Number(conditions.maxHumidityX10) / 10 : null;
  const findings = [];
  if (!rows.length) {
    return { samples: 0, findings: [{ code: "NO_DATA", severity: "info", text: "No smart-box readings for this trip yet.", weight: 0 }] };
  }

  const steps = rows.slice(1).map((r, i) => r.t - rows[i].t).filter((d) => d > 0);
  const interval = median(steps) || 10;
  const cap = interval * 2; // a missing stretch is a gap, not "time at the last temperature"
  const dur = (i) => Math.min(cap, (rows[i + 1]?.t ?? rows[i].t + interval) - rows[i].t);

  const temps = rows.filter((r) => r.temp_x10 != null).map((r) => ({ t: r.t, c: r.temp_x10 / 10 }));
  const mkt = meanKineticTemperature(temps, cap);
  let above = 0, below = 0, humid = 0, peakHigh = null, peakLow = null, maxH = null;
  const excursions = [];
  let run = null;
  rows.forEach((r, i) => {
    const c = r.temp_x10 == null ? null : r.temp_x10 / 10;
    const h = r.humidity_x10 == null ? null : r.humidity_x10 / 10;
    if (h != null) maxH = Math.max(maxH ?? h, h);
    if (h != null && maxHum != null && h > maxHum) humid += dur(i);
    const kind = c == null ? null : c > hi ? "hot" : c < lo ? "cold" : null;
    if (kind === "hot") {
      above += dur(i);
      peakHigh = Math.max(peakHigh ?? c, c);
    }
    if (kind === "cold") {
      below += dur(i);
      peakLow = Math.min(peakLow ?? c, c);
    }
    if (kind && run?.kind === kind) {
      run.end = r.t + dur(i);
      run.peak = kind === "hot" ? Math.max(run.peak, c) : Math.min(run.peak, c);
    } else {
      if (run) excursions.push(run);
      run = kind ? { kind, start: r.t, end: r.t + dur(i), peak: c } : null;
    }
  });
  if (run) excursions.push(run);

  let tamperEvents = 0;
  rows.forEach((r, i) => {
    if (r.flags & 1 && !(rows[i - 1]?.flags & 1)) tamperEvents++;
  });
  const gaps = steps.filter((d) => d > interval * 3);
  const gapSeconds = gaps.reduce((a, d) => a + d, 0);
  const durationSeconds = rows.at(-1).t - rows[0].t + interval;
  const sensorFaults = rows.filter((r) => r.temp_x10 == null).length;

  // ---- findings
  const exMinutes = minutes(above + below);
  if (above > 0) {
    const crit = above >= 30 * 60 || peakHigh - hi >= 5;
    findings.push({
      code: "TEMP_HIGH",
      severity: crit ? "critical" : "warning",
      text: `Temperature excursion beyond safe limit: up to ${round(peakHigh)}°C (limit ${hi}°C) for ${minutes(above)} min.`,
      weight: crit ? 45 : 20,
    });
  }
  if (below > 0) {
    const crit = below >= 30 * 60 || lo - peakLow >= 3;
    findings.push({
      code: "TEMP_LOW",
      severity: crit ? "critical" : "warning",
      text: `Too cold: down to ${round(peakLow)}°C (limit ${lo}°C) for ${minutes(below)} min${lo > 0 && peakLow <= 0 ? " (possible freezing)" : ""}.`,
      weight: crit ? 45 : 20,
    });
  }
  if (mkt != null && (mkt > hi || mkt < lo)) {
    findings.push({
      code: "MKT_OUT",
      severity: "critical",
      text: `Mean kinetic temperature ${round(mkt)}°C is outside the ${lo}–${hi}°C storage range over the whole trip.`,
      weight: 25,
    });
  }
  if (humid > 0) {
    findings.push({ code: "HUMIDITY", severity: humid >= 30 * 60 ? "critical" : "warning", text: `Humidity above ${maxHum}% for ${minutes(humid)} min (peak ${round(maxH)}%).`, weight: humid >= 30 * 60 ? 20 : 10 });
  }
  if (tamperEvents > 0) {
    findings.push({ code: "TAMPER", severity: "critical", text: `Box opened ${tamperEvents} time${tamperEvents > 1 ? "s" : ""} in transit: contents may have been swapped.`, weight: 35 });
  }
  if (sensorFaults > 0) {
    findings.push({ code: "SENSOR_FAULT", severity: "warning", text: `Temperature sensor gave no reading ${sensorFaults} time${sensorFaults > 1 ? "s" : ""}.`, weight: 10 });
  }
  if (gapSeconds > 0) {
    findings.push({ code: "SENSOR_GAP", severity: "warning", text: `No readings for ${minutes(gapSeconds)} min in total (${gaps.length} gap${gaps.length > 1 ? "s" : ""}): the box may have been offline.`, weight: 10 });
  }
  if (!findings.length) {
    findings.push({ code: "OK", severity: "info", text: `Kept within ${lo}–${hi}°C for the whole trip (MKT ${round(mkt)}°C).`, weight: 0 });
  }

  return {
    samples: rows.length,
    durationMinutes: minutes(durationSeconds),
    intervalSeconds: interval,
    mkt: round(mkt, 2),
    minC: temps.length ? round(Math.min(...temps.map((p) => p.c))) : null,
    maxC: temps.length ? round(Math.max(...temps.map((p) => p.c))) : null,
    meanC: temps.length ? round(temps.reduce((a, p) => a + p.c, 0) / temps.length, 2) : null,
    maxHumidity: round(maxH),
    minutesAbove: minutes(above),
    minutesBelow: minutes(below),
    minutesHumid: minutes(humid),
    excursionMinutes: exMinutes,
    fractionOut: durationSeconds ? (above + below) / durationSeconds : 0,
    excursions: excursions.map((e) => ({ ...e, minutes: minutes(e.end - e.start), peak: round(e.peak) })),
    tamperEvents,
    gapMinutes: minutes(gapSeconds),
    sensorFaults,
    gpsFixes: rows.filter((r) => r.flags & 2).length,
    findings,
  };
}

/** Feature vector for the anomaly model (one row per trip). */
export function tripFeatures(a) {
  return [a.mkt ?? 0, a.maxC ?? 0, a.fractionOut ?? 0, a.maxHumidity ?? 0, a.tamperEvents ?? 0, a.gapMinutes / Math.max(1, a.durationMinutes), a.durationMinutes / 60];
}
