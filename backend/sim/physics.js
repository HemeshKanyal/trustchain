// Small, honest physics: city climate + time of day outside, insulation + refrigeration inside.

const IST = 5.5 * 3600;
export const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Outside air temperature (°C) and humidity (%) for a climate at a unix time: warmest ~15:00 IST. */
export function ambient(climate, unix) {
  const hour = (((unix + IST) % 86400) + 86400) % 86400 / 3600;
  const t = climate.mean + (climate.swing / 2) * Math.sin((2 * Math.PI * (hour - 9)) / 24) + gauss() * 0.4;
  const rh = Math.min(98, Math.max(15, climate.rh - (t - climate.mean) * 2 + gauss() * 2));
  return { t, rh };
}

const lerp = (a, b, f) => a + (b - a) * f;
/** Point along a slightly curved road between two cities, with GPS jitter. */
export function routePoint(from, to, f) {
  const bend = Math.sin(Math.PI * f) * 0.6; // roads aren't straight lines
  const lat = lerp(from[0], to[0], f) + bend * 0.15 * Math.sign(to[1] - from[1] || 1) + gauss() * 0.002;
  const lon = lerp(from[1], to[1], f) - bend * 0.15 * Math.sign(to[0] - from[0] || 1) + gauss() * 0.002;
  return [lat, lon];
}

/** Road distance estimate (km): great-circle × 1.25. */
export function roadKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.25;
}

/**
 * One box's interior. Cold products ride in a reefer (setpoint 5°C); others in an air-conditioned van (22°C),
 * because most Indian label conditions ("store below 25/30°C") can't be met by a passive box in October.
 * step(dtPhysSeconds, outside) advances the model in ≤60 s sub-steps; faults toggle cooling and lid.
 */
export class BoxThermal {
  constructor({ cold }) {
    this.cold = cold;
    this.setpoint = cold ? 5 : 22;
    this.t = this.setpoint + gauss() * 0.4;
    this.rh = 45 + gauss() * 3;
    this.coolingOk = true;
    this.lidOpen = false;
  }
  step(dt, outside) {
    const n = Math.max(1, Math.ceil(dt / 60));
    const h = dt / n;
    const tauLeak = this.lidOpen ? 900 : this.cold ? 4 * 3600 : 2.5 * 3600; // s: an open lid mixes fast
    const tauCool = this.cold ? 600 : 1800;
    const rhTarget = this.lidOpen ? outside.rh : 45;
    const tauRh = this.lidOpen ? 600 : 3 * 3600;
    for (let k = 0; k < n; k++) {
      this.t += ((outside.t - this.t) * h) / tauLeak;
      if (this.coolingOk && this.t > this.setpoint) this.t += ((this.setpoint - this.t) * h) / tauCool;
      this.rh += ((rhTarget - this.rh) * h) / tauRh;
    }
    this.t += gauss() * 0.05;
    this.rh += gauss() * 0.3;
    // what a DHT22 would report: ±0.2 °C / ±1 %RH reading noise on top of the true value
    return { t: this.t + gauss() * 0.2, rh: Math.min(99, Math.max(5, this.rh + gauss())) };
  }
}
