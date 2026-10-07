// Showcase simulator (backend/sim): public "is it running" status for the site banner, admin-only controls.
import { requireSession } from "./auth.js";
import { isAdminAddress } from "./routes-app.js";

const SIM_URL = process.env.SIM_CONTROL_URL ?? `http://127.0.0.1:${process.env.SIM_PORT ?? 4100}`;
const httpError = (status, message) => Object.assign(new Error(message), { status });

async function simFetch(path, method = "GET") {
  let r;
  try {
    r = await fetch(`${SIM_URL}${path}`, { method, headers: { "x-sim-token": process.env.SIM_CONTROL_TOKEN ?? "" }, signal: AbortSignal.timeout(4000) });
  } catch {
    return null; // not running
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(r.status === 401 ? 502 : 400, body.error ?? `simulator ${r.status}`);
  return body;
}

export function registerSimRoutes(app, asyncRoute) {
  app.get("/api/sim/status", asyncRoute(async (_req, res) => {
    const s = await simFetch("/status");
    if (!s) return res.json({ running: false });
    // public: enough for the "simulated network" banner and live counters
    res.json({ running: true, paused: s.paused, preset: s.preset, startedAt: s.startedAt, counters: s.counters, orgs: s.orgs.map(({ balance, ...o }) => o), trips: s.trips, boxes: s.boxes });
  }));
  const admin = async (req) => {
    const who = requireSession(req);
    if (!(await isAdminAddress(who))) throw httpError(403, "admins only");
  };
  app.get("/api/sim/admin", asyncRoute(async (req, res) => {
    await admin(req);
    res.json((await simFetch("/status")) ?? { running: false });
  }));
  app.get("/api/sim/events", asyncRoute(async (req, res) => {
    const after = Number(req.query.after ?? 0) || 0;
    res.json((await simFetch(`/events?after=${after}`)) ?? []);
  }));
  for (const action of ["pause", "resume"]) {
    app.post(`/api/sim/${action}`, asyncRoute(async (req, res) => {
      await admin(req);
      const out = await simFetch(`/${action}`, "POST");
      if (!out) throw httpError(503, "simulator not running");
      res.json(out);
    }));
  }
  app.post("/api/sim/scenario/:name", asyncRoute(async (req, res) => {
    await admin(req);
    const out = await simFetch(`/scenario/${encodeURIComponent(req.params.name)}`, "POST");
    if (!out) throw httpError(503, "simulator not running");
    res.json(out);
  }));
}
