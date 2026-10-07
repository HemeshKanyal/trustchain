import { EventEmitter } from "node:events";

/** In-process bus: "alert" events feed the SSE stream. */
export const bus = new EventEmitter();
bus.setMaxListeners(1000);
