// The people of the simulated network. Every decision ends in a real, signed transaction or API call.
import { keccak256, stringToHex, toHex, zeroAddress } from "viem";
import { sim } from "./config.js";
import { CITIES, ORGS, PRODUCTS, isCold, productByKey } from "./world.js";
import { publicClient, tc } from "./chain.js";
import { saveState } from "./state.js";
import { roadKm } from "./physics.js";

const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const lower = (a) => a.toLowerCase();
function poisson(lambda) {
  if (lambda <= 0) return 0;
  let k = 0, p = 1;
  const L = Math.exp(-lambda);
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
function weighted(items, w) {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = Math.random() * total;
  for (const x of items) if ((r -= w(x)) <= 0) return x;
  return items.at(-1);
}
const errText = (e) => e?.shortMessage?.split("\n")[0] ?? e?.message ?? String(e);
const IST = 5.5 * 3600;
const istHour = (t = now()) => ((t + IST) % 86400) / 3600;
const istDow = (t = now()) => new Date((t + IST) * 1000).getUTCDay();

export class Engine {
  constructor({ state, regulator, orgs, boxes, realBoxes, patients, log }) {
    this.s = state;
    this.regulator = regulator;
    this.orgs = orgs; // id -> { ...ORGS entry, w: Wallet }
    this.boxes = boxes; // VirtualBox[]
    this.realBoxes = realBoxes.map((address) => ({ address, real: true, busy: null }));
    this.patients = patients; // [{ address, visitor }]
    this.log = log;
    this.paused = false;
    this.forced = []; // faults queued by showcase scenarios
    this.priceDump = null; // { pharmacy, until }
    this.busy = new Set();
    this.lastAlert = state.lastAlert ?? 0;
    const s = this.s;
    s.pools ??= {}; // holder -> batchId -> [strip indices]
    s.trips ??= {}; // shipmentId -> trip
    s.sold ??= {}; // batchId -> [strip indices dispensed]
    s.reviews ??= {}; // quarantined batchId -> when the regulator decides
  }

  // ------------------------------------------------------------------ helpers
  save() {
    saveState(this.s);
  }
  org(address) {
    return Object.values(this.orgs).find((o) => lower(o.w.address) === lower(address));
  }
  pool(holder, batchId) {
    const h = (this.s.pools[lower(holder)] ??= {});
    return (h[batchId] ??= []);
  }
  usable(batchId) {
    const b = this.s.batches[batchId];
    return b && b.status === 0 && b.expiresAt > now() + 86400;
  }
  /** Sellable stock a holder has of a product, oldest expiry first. */
  stockOf(holder, productKey) {
    const h = this.s.pools[lower(holder)] ?? {};
    return Object.entries(h)
      .filter(([id, idx]) => idx.length && this.s.batches[id]?.product === productKey && this.usable(id))
      .map(([id, idx]) => ({ batchId: Number(id), n: idx.length, expiresAt: this.s.batches[id].expiresAt }))
      .sort((a, b) => a.expiresAt - b.expiresAt);
  }
  count(holder, productKey) {
    return this.stockOf(holder, productKey).reduce((s, x) => s + x.n, 0);
  }
  inbound(holder, productKey) {
    return Object.values(this.s.trips)
      .filter((t) => lower(t.to) === lower(holder) && this.s.batches[t.batchId]?.product === productKey)
      .reduce((s, t) => s + t.qty, 0);
  }
  /** Expected strips per hour a pharmacy sells of a product (the same model the sales use). */
  demandPerHour(productKey) {
    const total = PRODUCTS.reduce((s, p) => s + p.perDay, 0);
    return (sim.salesPerPharmacyPerHour * productByKey[productKey].perDay) / total;
  }
  event(kind, text, extra = {}) {
    this.log(text, { kind, ...extra });
  }
  once(key, fn) {
    if (this.busy.has(key)) return;
    this.busy.add(key);
    fn().catch((e) => this.event("error", `${key}: ${errText(e)}`)).finally(() => this.busy.delete(key));
  }

  // ------------------------------------------------------------------ main loop
  async run() {
    for (const trip of Object.values(this.s.trips)) this.once(`trip:${trip.id}`, () => this.drive(trip));
    let last = Date.now();
    for (;;) {
      await sleep(sim.tick * 1000);
      const dt = (Date.now() - last) / 1000;
      last = Date.now();
      if (this.paused) continue;
      this.once("alerts", () => this.watchAlerts());
      for (const o of Object.values(this.orgs)) {
        if (o.role === 4) this.once(`sell:${o.id}`, () => this.pharmacySales(o, dt));
        if (o.role === 4) this.once(`restock:${o.id}`, () => this.restockPharmacy(o));
        if (o.role === 3) this.once(`restock:${o.id}`, () => this.restockDistributor(o));
        if (o.role === 2) this.once(`produce:${o.id}`, () => this.produce(o));
      }
      this.once("counterfeit", () => this.counterfeiters(dt));
      for (const [batchId, rv] of Object.entries(this.s.reviews)) if (rv.due <= now()) this.once(`review:${batchId}`, () => this.review(Number(batchId)));
      for (const t of Object.values(this.s.trips)) if (now() > t.endsAt + 60) this.once(`trip:${t.id}`, () => this.drive(t)); // retry a failed delivery
      this.save();
    }
  }

  // ------------------------------------------------------------------ manufacturers
  async produce(m) {
    for (const key of m.makes) {
      // demand from every distributor this maker serves
      const dists = Object.values(this.orgs).filter((o) => o.role === 3);
      const need = dists.length * this.distTarget(key);
      if (this.count(m.w.address, key) >= need * 0.6) continue;
      await this.makeBatch(m, key, Math.max(100, Math.min(1000, Math.ceil(need * 2 / 50) * 50)));
    }
  }
  async makeBatch(m, key, qty) {
    const p = productByKey[key];
    const seq = (this.s.counters.batches = (this.s.counters.batches ?? 0) + 1);
    const d = new Date();
    const lot = `${m.name.split(" ").map((w) => w[0]).join("").toUpperCase()}${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
    const expiresAt = now() + p.shelfDays * 86400;
    const meta = keccak256(stringToHex(JSON.stringify({ product: p.name, lot, site: `${m.name}, ${m.city}`, storage: p.cond })));
    const { result: id } = await m.w.send(tc, "createBatch", [p.name, lot, qty, BigInt(expiresAt), p.rx, p.cond, meta]);
    const batchId = Number(id);
    // Each strip's QR carries a random 32-byte secret; only its hash goes on-chain.
    const secrets = Array.from({ length: qty }, () => toHex(crypto.getRandomValues(new Uint8Array(32))));
    this.s.batches[batchId] = { product: key, maker: m.w.address, secrets, expiresAt, status: 0, lot };
    this.save();
    for (let i = 0; i < qty; i += 200) await m.w.send(tc, "registerStrips", [id, secrets.slice(i, i + 200).map((x) => keccak256(x))]);
    this.pool(m.w.address, batchId).push(...secrets.map((_, i) => i));
    this.event("batch", `${m.name} manufactured ${p.name}, lot ${lot} (${qty} strips) as batch #${batchId}`, { batchId });
  }

  // ------------------------------------------------------------------ distributors
  distTarget(key) {
    // a distributor keeps ~8 hours of its pharmacies' demand (live pace) or ~45 min (showcase)
    const hours = sim.preset === "live" ? 8 : 0.75;
    return Math.max(20, Math.ceil(this.demandPerHour(key) * 3 * hours));
  }
  async restockDistributor(d) {
    for (const key of Object.keys(productByKey)) {
      const have = this.count(d.w.address, key) + this.inbound(d.w.address, key);
      const target = this.distTarget(key);
      if (have >= target * 0.5) continue;
      const makers = Object.values(this.orgs).filter((o) => o.role === 2 && o.makes.includes(key));
      const maker = makers.sort((a, b) => roadKm(CITIES[a.city].at, CITIES[d.city].at) - roadKm(CITIES[b.city].at, CITIES[d.city].at))
        .find((m) => this.count(m.w.address, key) > 0);
      if (!maker) continue;
      await this.ship(maker, d, key, target * 1.5 - have);
    }
  }

  // ------------------------------------------------------------------ pharmacies
  pharmTarget(key) {
    const hours = sim.preset === "live" ? 24 : 2;
    return Math.max(5, Math.ceil(this.demandPerHour(key) * hours));
  }
  async restockPharmacy(p) {
    const d = this.orgs[p.dist];
    for (const key of Object.keys(productByKey)) {
      const have = this.count(p.w.address, key) + this.inbound(p.w.address, key);
      const target = this.pharmTarget(key);
      if (have >= target * 0.5) continue;
      if (this.count(d.w.address, key) === 0) continue;
      await this.ship(d, p, key, target * 1.5 - have);
    }
  }

  /** Customers walking in: Poisson arrivals, more on weekends for OTC, opening hours on the live preset. */
  async pharmacySales(p, dt) {
    let rate = sim.salesPerPharmacyPerHour / 1.4;
    if (sim.preset === "live") {
      const h = istHour();
      rate *= h < 8 || h > 23 ? 0 : 0.6 + 0.8 * Math.exp(-(((h - 19) / 3) ** 2)); // evening rush
    }
    const customers = poisson((rate * dt) / 3600);
    if (!customers) return;
    const weekend = [0, 6].includes(istDow());
    const otc = [];
    for (let c = 0; c < customers; c++) {
      const prod = weighted(PRODUCTS, (x) => x.perDay * (weekend ? x.weekend : 1));
      const strips = 1 + poisson(0.4);
      if (prod.rx) await this.prescribedSale(p, prod, strips);
      else otc.push([prod, strips]);
    }
    if (otc.length) await this.otcSale(p, otc);
  }
  takeStrips(holder, key, n) {
    const out = [];
    for (const s of this.stockOf(holder, key)) {
      const idx = this.pool(holder, s.batchId);
      const k = Math.min(n - out.length, idx.length);
      out.push(...idx.slice(0, k).map((i) => ({ batchId: s.batchId, i })));
      if (out.length >= n) break;
    }
    return out;
  }
  commit(holder, strips) {
    for (const { batchId, i } of strips) {
      const idx = this.pool(holder, batchId);
      const at = idx.indexOf(i);
      if (at >= 0) idx.splice(at, 1);
      (this.s.sold[batchId] ??= []).push(i);
    }
  }
  price(p, batchId) {
    const prod = productByKey[this.s.batches[batchId].product];
    const dump = this.priceDump && this.priceDump.pharmacy === p.id && this.priceDump.until > now();
    return Math.round(prod.price * (dump ? rnd(0.35, 0.45) : rnd(0.93, 1.08)));
  }
  async otcSale(p, basket) {
    const strips = basket.flatMap(([prod, n]) => this.takeStrips(p.w.address, prod.key, n));
    if (!strips.length) return;
    await p.w.send(tc, "dispense", [strips.map((x) => this.s.batches[x.batchId].secrets[x.i]), zeroAddress, 0n]);
    this.commit(p.w.address, strips);
    this.s.counters.sales += strips.length;
    await this.afterSale(p, strips, null);
  }
  async prescribedSale(p, prod, n) {
    const strips = this.takeStrips(p.w.address, prod.key, n);
    if (!strips.length) return;
    const patient = pick(this.patients);
    const doctor = Object.values(this.orgs).find((o) => o.role === 5 && o.city === p.city) ?? pick(Object.values(this.orgs).filter((o) => o.role === 5));
    const text = `${prod.name}: ${n} strip${n > 1 ? "s" : ""}. ${prod.key === "insulin" ? "10 units at bedtime" : prod.key === "hepb" ? "Single dose, intramuscular" : "One tablet twice daily after food"}. Patient ${patient.name}. Issued by ${doctor.name}, ${doctor.city}.`;
    const { result: rxId } = await doctor.w.send(tc, "issuePrescription", [patient.address, keccak256(stringToHex(text)), BigInt(now() + 30 * 86400), n]);
    await doctor.w.api(`/api/prescriptions/${rxId}/details`, { text }, "PUT").catch(() => {});
    this.s.counters.prescriptions++;
    await p.w.send(tc, "dispense", [strips.map((x) => this.s.batches[x.batchId].secrets[x.i]), patient.address, rxId]);
    this.commit(p.w.address, strips);
    this.s.counters.sales += strips.length;
    await this.afterSale(p, strips, patient);
  }
  async afterSale(p, strips, patient) {
    // the pharmacy logs what it charged; buyers sometimes check their strip on the Verify page
    const byBatch = [...new Set(strips.map((x) => x.batchId))];
    for (const b of byBatch) if (Math.random() < 0.5) await p.w.api("/api/prices", { batchId: b, price: this.price(p, b) }).catch(() => {});
    if (Math.random() < sim.patientScanChance) {
      const x = pick(strips);
      await this.scan(keccak256(this.s.batches[x.batchId].secrets[x.i]), patient?.visitor ?? randomVisitor());
    }
  }
  async scan(codeHash, visitor) {
    const v = await publicClient.readContract({ ...tc, functionName: "verify", args: [codeHash] });
    const verdict = ["unknown", "genuine", "dispensed", "recalled", "quarantined", "expired"][Number(v.verdict)];
    await fetch(`${sim.apiUrl}/api/scans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeHash, verdict, visitor }) });
    this.s.counters.scans++;
    return verdict;
  }

  // ------------------------------------------------------------------ trucks
  freeBox(cold) {
    const virtual = this.boxes.filter((b) => !b.busy);
    const real = this.realBoxes.filter((b) => !b.busy);
    if (real.length && Math.random() < 0.34) return real[0];
    return virtual[0] ?? (cold ? null : undefined);
  }
  async ship(from, to, key, want) {
    want = Math.floor(want);
    const stock = this.stockOf(from.w.address, key);
    if (!stock.length || want <= 0) return;
    const { batchId } = stock[0]; // first expiry, first out
    const qty = Math.min(want, stock[0].n);
    const cold = isCold(productByKey[key]);
    let box = this.freeBox(cold);
    if (!box) {
      // No reefer free: a careful shipper waits; Hooghly sometimes cuts corners (the compliance AI notices).
      if (from.id !== "d-hooghly" || Math.random() > 0.3) return;
      box = null;
    }
    // room-temperature stock often moves unmonitored, and never takes the last free boxes from the cold chain
    if (!cold && box && (Math.random() < 0.4 || this.boxes.filter((b) => !b.busy).length <= 4)) box = null;
    if (box) box.busy = "loading";
    const idx = this.pool(from.w.address, batchId).splice(0, qty); // reserved: concurrent orders can't double-ship it
    try {
      const { result: sid } = await from.w.send(tc, "createShipment", [BigInt(batchId), to.w.address, qty, box?.address ?? zeroAddress]);
      const a = CITIES[from.city], b = CITIES[to.city];
      const km = Math.max(15, roadKm(a.at, b.at));
      const [lo, hi] = sim.tripMinutes;
      const minutes = lo + (hi - lo) * Math.min(1, km / 2000) + rnd(-0.5, 0.5);
      const forced = box && !box.real && cold ? this.forced.shift() : null; // showcase faults go on cold-chain trucks
      const faults = {
        cooling: forced === "heat" ? 0.25 : Math.random() < sim.reefersFailChance ? rnd(0.2, 0.6) : null,
        lid: forced === "lid" ? 0.4 : Math.random() < sim.lidOpenChance ? rnd(0.2, 0.8) : null,
        sensor: forced === "sensor" ? 0.3 : Math.random() < sim.sensorDropChance ? rnd(0.1, 0.8) : null,
      };
      if (forced) this.event("scenario", `Showcase: ${forced} fault planted on shipment #${sid}`);
      const trip = { id: Number(sid), from: from.w.address, to: to.w.address, fromId: from.id, toId: to.id, batchId, qty, idx, box: box?.address ?? null, real: !!box?.real, cold, km: Math.round(km), startedAt: now(), endsAt: now() + Math.round(minutes * 60), faults };
      this.s.trips[trip.id] = trip;
      this.save();
      this.event("ship", `${from.name} → ${to.name}: ${qty} × ${productByKey[key].name} (${trip.km} km${box ? `, ${box.real ? "real ESP32" : box.label}` : ", no tracker"}), shipment #${sid}`, { shipmentId: trip.id, batchId });
      if (box) box.busy = trip.id;
      this.once(`trip:${trip.id}`, () => this.drive(trip));
    } catch (e) {
      if (box) box.busy = null;
      this.pool(from.w.address, batchId).unshift(...idx);
      throw e;
    }
  }
  async drive(trip) {
    const box = trip.box && this.boxes.find((b) => lower(b.address) === lower(trip.box));
    const real = trip.box && this.realBoxes.find((b) => lower(b.address) === lower(trip.box));
    const remaining = Math.max(5, trip.endsAt - now());
    if (now() >= trip.endsAt) {
      // already arrived (restart or retry): just hand over
    } else if (box) {
      const from = this.orgs[trip.fromId], to = this.orgs[trip.toId];
      const r = await box.ride({
        shipmentId: trip.id, cold: trip.cold, realSeconds: remaining, faults: trip.faults,
        route: { from: CITIES[from.city].at, to: CITIES[to.city].at, fromClimate: CITIES[from.city], toClimate: CITIES[to.city], km: trip.km },
      });
      if (r.events.length) this.event("fault", `Shipment #${trip.id}: ${r.events.join(", ")} (box ended at ${r.finalC} °C)`, { shipmentId: trip.id });
    } else {
      if (real) real.busy = trip.id;
      await sleep(remaining * 1000);
      if (real) real.busy = null;
    }
    await this.deliver(trip);
  }
  async deliver(trip) {
    const to = this.orgs[trip.toId];
    if (to.role === 4 || to.role === 3) {
      // the receiver scans one strip from the carton: does it belong to the batch on the paperwork?
      await to.w.api("/api/receive-checks", { shipmentId: trip.id, foundBatchId: trip.batchId }).catch(() => {});
    }
    // occasionally a pharmacy is slow to confirm receipt (compliance notices)
    if (to.role === 4 && Math.random() < 0.05) await sleep(rnd(30, 90) * 1000);
    await to.w.send(tc, "receiveShipment", [BigInt(trip.id)]);
    this.pool(to.w.address, trip.batchId).push(...trip.idx);
    delete this.s.trips[trip.id];
    this.s.counters.trips++;
    this.save();
    this.event("deliver", `${to.name} received shipment #${trip.id}`, { shipmentId: trip.id, batchId: trip.batchId });
    if (this.s.batches[trip.batchId]?.status === 2) this.once(`returns:${trip.batchId}`, () => this.returns(trip.batchId)); // recalled while on the road
  }

  // ------------------------------------------------------------------ regulator
  async watchAlerts() {
    const list = await fetch(`${sim.apiUrl}/api/alerts?limit=100`).then((r) => r.json());
    for (const a of list.filter((x) => x.id > this.lastAlert).sort((x, y) => x.id - y.id)) {
      this.lastAlert = this.s.lastAlert = a.id;
      const b = this.s.batches[a.batchId];
      if (!b) continue; // not a simulated batch: leave it to real people
      if (a.type === "breach" || a.type === "quarantine") {
        b.status = 1;
        const rv = (this.s.reviews[a.batchId] ??= { due: now() + Math.round(rnd(...sim.reviewMinutes) * 60), flags: 0 });
        rv.flags |= a.details?.reasonFlags ?? 0;
      } else if (a.type === "quarantine_released") {
        b.status = 0;
      } else if (a.type === "recall") {
        b.status = 2;
        this.once(`returns:${a.batchId}`, () => this.returns(a.batchId));
      }
    }
  }
  /** The regulator reads the cold-chain evidence and TrustChain AI's risk score, then decides. */
  async review(batchId) {
    const flags = this.s.reviews[batchId]?.flags ?? 0;
    delete this.s.reviews[batchId];
    const b = await publicClient.readContract({ ...tc, functionName: "getBatch", args: [BigInt(batchId)] });
    if (Number(b.status) !== 1) return;
    const risk = await fetch(`${sim.apiUrl}/api/ai/batches/${batchId}/risk`).then((r) => r.json()).catch(() => null);
    const score = risk?.score ?? 50;
    // Heat or cold damage can't be undone; an opened box or a sensor gap gets inspected and usually released.
    const tempDamage = (flags & 3) !== 0;
    const recall = tempDamage ? score >= 75 || Math.random() < 0.15 : Math.random() < 0.05;
    const why = tempDamage ? "temperature excursion" : flags & 4 ? "humidity excursion" : "box opened / sensor gap";
    if (recall) {
      await this.regulator.send(tc, "recallBatch", [BigInt(batchId), `Regulator review after ${why}: stability cannot be assured (AI risk ${score}/100)`]);
      this.event("recall", `Regulator recalled batch #${batchId} after ${why} (AI risk ${score}/100)`, { batchId });
    } else {
      await this.regulator.send(tc, "releaseQuarantine", [BigInt(batchId), tempDamage ? `Reviewed ${why}: short, stability data acceptable (AI risk ${score}/100)` : `Reviewed ${why}: contents inspected, seals and counts intact (AI risk ${score}/100)`]);
      this.event("release", `Regulator released batch #${batchId} after reviewing a ${why} (AI risk ${score}/100)`, { batchId });
    }
  }
  /** After a recall every holder sends its remaining strips back to the manufacturer. */
  async returns(batchId) {
    const b = this.s.batches[batchId];
    const maker = this.org(b.maker);
    for (const o of Object.values(this.orgs)) {
      if (o === maker) continue;
      const idx = this.pool(o.w.address, batchId);
      if (!idx.length) continue;
      const qty = idx.length;
      const { result: sid } = await o.w.send(tc, "createShipment", [BigInt(batchId), maker.w.address, qty, zeroAddress]);
      idx.length = 0;
      this.event("return", `${o.name} returned ${qty} recalled strips of batch #${batchId} to ${maker.name}`, { shipmentId: Number(sid), batchId });
      this.once(`return:${sid}`, async () => {
        await sleep(rnd(20, 60) * 1000);
        await maker.w.send(tc, "receiveShipment", [sid]);
      });
    }
  }

  // ------------------------------------------------------------------ counterfeiters
  async counterfeiters(dt) {
    const n = poisson((sim.counterfeitScansPerHour * dt) / 3600);
    for (let i = 0; i < n; i++) await this.scan(toHex(crypto.getRandomValues(new Uint8Array(32))), randomVisitor());
  }

  // ------------------------------------------------------------------ showcase scenarios
  async scenario(name) {
    switch (name) {
      case "heat":
      case "lid":
      case "sensor": {
        // hit a cold trip already on the road if there is one, else the next one
        const running = Object.values(this.s.trips).find((t) => t.cold && t.box && !t.real && now() < t.endsAt - 30);
        if (running) {
          const f = (now() - running.startedAt) / (running.endsAt - running.startedAt) + 0.02;
          running.faults[{ heat: "cooling", lid: "lid", sensor: "sensor" }[name]] = f;
          this.event("scenario", `Showcase: ${name} fault on shipment #${running.id}, already on the road`, { shipmentId: running.id });
          return { shipmentId: running.id };
        }
        this.forced.push(name);
        return { queued: true };
      }
      case "counterfeit-wave": {
        const ring = Array.from({ length: 5 }, randomVisitor);
        for (let i = 0; i < 14; i++) await this.scan(toHex(crypto.getRandomValues(new Uint8Array(32))), pick(ring));
        this.event("scenario", "Showcase: a wave of fake QR codes scanned on the Verify page");
        return { scans: 14 };
      }
      case "clone": {
        const ids = Object.keys(this.s.sold).filter((id) => this.s.sold[id].length);
        if (!ids.length) throw new Error("nothing sold yet");
        const batchId = pick(ids);
        const code = keccak256(this.s.batches[batchId].secrets[pick(this.s.sold[batchId])]);
        for (let i = 0; i < 4; i++) await this.scan(code, randomVisitor());
        this.event("scenario", `Showcase: one sold strip of batch #${batchId} scanned by 4 different people (copied QR)`, { batchId: Number(batchId) });
        return { batchId: Number(batchId), codeHash: code };
      }
      case "recall": {
        const ids = Object.keys(this.s.batches).filter((id) => this.usable(id));
        if (!ids.length) throw new Error("no active batch");
        const batchId = pick(ids);
        const m = this.org(this.s.batches[batchId].maker);
        await m.w.send(tc, "recallBatch", [BigInt(batchId), "Dissolution test failed at the 6-month stability check"]);
        this.event("recall", `${m.name} recalled batch #${batchId}`, { batchId: Number(batchId) });
        return { batchId: Number(batchId) };
      }
      case "price-dump": {
        const p = pick(Object.values(this.orgs).filter((o) => o.role === 4));
        this.priceDump = { pharmacy: p.id, until: now() + 15 * 60 };
        this.event("scenario", `Showcase: ${p.name} sells far below market for 15 minutes`);
        return { pharmacy: p.w.address };
      }
      default:
        throw new Error(`unknown scenario ${name}`);
    }
  }
}

function randomVisitor() {
  return crypto.randomUUID();
}
export const SCENARIOS = ["heat", "lid", "sensor", "counterfeit-wave", "clone", "recall", "price-dump"];
export { ORGS };
