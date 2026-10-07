export const ROLES = ["None", "Admin", "Manufacturer", "Distributor", "Pharmacy", "Doctor"];
export const ROLE_PATH = { 1: "/admin", 2: "/manufacturer", 3: "/distributor", 4: "/pharmacy", 5: "/doctor" };
export const BATCH_STATUS = ["Active", "Quarantined", "Recalled"];
export const SHIPMENT_STATUS = ["None", "In transit", "Delivered", "Cancelled"];
export const ZERO = "0x0000000000000000000000000000000000000000";

export const VERDICTS = [
  { key: "unknown", label: "Not recognised", tone: "danger", advice: "This code is not registered by any licensed manufacturer. Do not use this medicine. Report it to the pharmacy or regulator." },
  { key: "genuine", label: "Genuine", tone: "ok", advice: "Registered by a licensed manufacturer, not yet sold, and the batch is in good standing." },
  { key: "dispensed", label: "Already dispensed", tone: "warn", advice: "This strip was already sold. If you just bought it from the pharmacy below, that's expected. Otherwise it may be a copied code." },
  { key: "recalled", label: "Recalled", tone: "danger", advice: "The manufacturer or regulator has recalled this batch. Do not take it; return it to the pharmacy." },
  { key: "quarantined", label: "On hold", tone: "warn", advice: "This batch is quarantined pending review (e.g. a temperature excursion in transit). Do not use until it is released." },
  { key: "expired", label: "Expired", tone: "danger", advice: "This medicine is past its expiry date. Do not use it." },
];

export const REASON_FLAGS = { 1: "Too cold", 2: "Too hot", 4: "Too humid", 8: "Box opened / sensor fault", 16: "Manual hold" };
export const reasons = (flags) =>
  Object.entries(REASON_FLAGS).filter(([bit]) => Number(flags) & Number(bit)).map(([, t]) => t);

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const date = (ts) => (ts ? new Date(Number(ts) * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const dateTime = (ts) =>
  ts ? new Date(Number(ts) * 1000).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const time = (ts) => (ts ? new Date(Number(ts) * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
export const temp = (x10) => `${(Number(x10) / 10).toFixed(1)}°C`;
export const pct = (x10) => `${(Number(x10) / 10).toFixed(0)}%`;
export const nowSec = () => Math.floor(Date.now() / 1000);
export const isExpired = (ts) => Number(ts) <= nowSec();
export const daysUntil = (ts) => Math.ceil((Number(ts) - nowSec()) / 86400);
/** Organisations created by the showcase simulator carry SIM- licences. */
export const isSimulated = (p) => Boolean(p?.licenseId?.startsWith("SIM-"));
export const isUsableBatch = (b) => b.status === 0 && !isExpired(b.expiresAt);
