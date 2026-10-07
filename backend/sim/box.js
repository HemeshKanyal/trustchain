// A virtual smart box: same protocol, same signatures, same path on-chain as the ESP32 tracker.
import { encodeDataHash, reportDomain, reportTypes, summarize } from "../src/telemetry.js";
import { config } from "../src/config.js";
import { sim } from "./config.js";
import { ambient, BoxThermal, routePoint } from "./physics.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

export class VirtualBox {
  constructor(account, label, state, log) {
    this.account = account;
    this.address = account.address;
    this.label = label;
    this.state = state;
    this.log = log;
    this.busy = null; // shipmentId while on a trip
  }

  async post(report, samples) {
    const signature = await this.account.signTypedData({ domain: reportDomain(config.chainId, config.monitor), types: reportTypes, primaryType: "Report", message: report });
    const body = JSON.stringify({ device: this.address, report, signature, samples, rfid: [] }, (_, v) => (typeof v === "bigint" ? Number(v) : v));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${sim.apiUrl}/api/telemetry`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (r.ok || r.status < 500) return r.status;
      } catch {
        /* backend restarting: retry */
      }
      await sleep(2000);
    }
    return 0;
  }

  /**
   * Ride one trip. route: { from, to, fromClimate, toClimate, km }, faults: { cooling: f|null, lid: f|null, sensor: f|null }
   * as fractions of the trip where each starts. Resolves when the truck arrives.
   */
  async ride({ shipmentId, cold, route, faults, realSeconds }) {
    this.busy = shipmentId;
    const hours = route.km / 55; // average truck speed incl. stops
    const compress = (hours * 3600) / realSeconds; // physical seconds per real second
    const box = new BoxThermal({ cold });
    const t0 = now();
    let windowStart = t0;
    let buf = [];
    const events = [];
    try {
      while (now() - t0 < realSeconds) {
        await sleep(sim.sampleSeconds * 1000);
        const t = now();
        const f = Math.min(1, (t - t0) / realSeconds);
        const climate = { mean: route.fromClimate.mean + (route.toClimate.mean - route.fromClimate.mean) * f, swing: route.fromClimate.swing, rh: route.fromClimate.rh + (route.toClimate.rh - route.fromClimate.rh) * f };
        if (faults.cooling != null && f >= faults.cooling && box.coolingOk) {
          box.coolingOk = false;
          events.push("cooling failed");
        }
        box.lidOpen = faults.lid != null && f >= faults.lid && f < faults.lid + 0.05;
        if (box.lidOpen && !events.includes("lid opened")) events.push("lid opened");
        const inside = box.step(sim.sampleSeconds * compress, ambient(climate, t));
        const sensorDown = faults.sensor != null && f >= faults.sensor && f < faults.sensor + 0.1;
        const gps = Math.random() > 0.08; // tunnels, dead zones
        const [lat, lon] = routePoint(route.from, route.to, f);
        buf.push([
          t,
          sensorDown ? -32768 : Math.round(inside.t * 10),
          sensorDown ? 65535 : Math.round(inside.rh * 10),
          gps ? Math.round(lat * 1e6) : 0,
          gps ? Math.round(lon * 1e6) : 0,
          (gps ? 2 : 0) | (box.lidOpen ? 1 : 0),
        ]);
        if (t - windowStart >= sim.windowSeconds || f >= 1) {
          const s = summarize(buf);
          const seq = (this.state.boxSeq[this.address] = (this.state.boxSeq[this.address] ?? Math.floor(Date.now() / 1000)) + 1);
          const report = { shipmentId: BigInt(shipmentId), windowStart: BigInt(buf[0][0]), windowEnd: BigInt(buf.at(-1)[0]), ...s, dataHash: encodeDataHash(buf, []), seq: BigInt(seq) };
          const status = await this.post(report, buf);
          this.state.counters.reports++;
          if (status !== 202 && status !== 200) this.log(`${this.label}: report for shipment #${shipmentId} got ${status}`);
          buf = [];
          windowStart = t;
        }
      }
      return { events, finalC: Math.round(box.t * 10) / 10 };
    } finally {
      this.busy = null;
    }
  }
}
