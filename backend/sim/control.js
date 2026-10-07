// Local control API for the showcase (the backend proxies it to signed-in admins as /api/sim/*).
import express from "express";
import { sim } from "./config.js";
import { SCENARIOS } from "./engine.js";

export function startControl({ engine, status, events, log }) {
  const app = express();
  app.use(express.json());
  const token = process.env.SIM_CONTROL_TOKEN || null;
  app.use((req, res, next) => {
    if (token && req.get("x-sim-token") !== token) return res.status(401).json({ error: "bad simulator token" });
    next();
  });
  const route = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      res.status(400).json({ error: e.shortMessage ?? e.message });
    }
  };
  app.get("/status", route(() => status()));
  app.get("/events", route((req) => events(Number(req.query.after ?? 0))));
  app.post("/pause", route(() => {
    engine.paused = true;
    log("paused", { kind: "control" });
    return { paused: true };
  }));
  app.post("/resume", route(() => {
    engine.paused = false;
    log("resumed", { kind: "control" });
    return { paused: false };
  }));
  app.post("/scenario/:name", route(async (req) => {
    if (!SCENARIOS.includes(req.params.name)) throw new Error(`unknown scenario; try ${SCENARIOS.join(", ")}`);
    return engine.scenario(req.params.name);
  }));
  app.listen(sim.controlPort, "127.0.0.1", () => log(`control API on http://127.0.0.1:${sim.controlPort}`));
}
