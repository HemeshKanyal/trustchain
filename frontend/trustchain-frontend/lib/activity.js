import { reasons, short } from "./format";

/** One readable line per chain event. `name(addr)` resolves organisation names. */
export function describe(e, name) {
  const a = e.args ?? {};
  const who = (x) => name(x) ?? short(x);
  switch (e.name) {
    case "BatchCreated":
      return `${who(a.manufacturer)} made ${a.quantity} strips of ${a.productName}`;
    case "ShipmentCreated":
      return `${who(a.from)} shipped ${a.quantity} strips to ${who(a.to)}`;
    case "ShipmentDelivered":
      return `${who(a.to)} received shipment #${a.shipmentId}`;
    case "StripDispensed":
      return `${who(a.pharmacy)} dispensed a strip${Number(a.prescriptionId) ? " against a prescription" : ""}`;
    case "BatchRecalled":
      return `Batch #${a.batchId} recalled: ${a.reason}`;
    case "BreachDetected":
      return `Smart box flagged shipment #${a.shipmentId}: ${reasons(a.reasonFlags).join(", ").toLowerCase()}`;
    case "QuarantineReleased":
      return `Regulator released batch #${a.batchId}`;
    case "ParticipantRegistered":
      return `${a.name} joined the network`;
    default:
      return e.name;
  }
}

export const toneOf = (e) => (e.name === "BatchRecalled" || e.name === "BreachDetected" ? "rose" : "teal");
