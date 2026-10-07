import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { ROLES, BATCH_STATUS } from "./format";

const MESSAGES = {
  NotAdmin: () => "Only an admin can do this.",
  NotOwnerForAdminRole: () => "Only the network owner can manage admins.",
  WrongRole: ([role]) => `Your account needs the ${ROLES[Number(role)]} role for this.`,
  InactiveParticipant: ([a]) => `Account ${a.slice(0, 8)}… is not an active participant.`,
  InvalidRole: () => "That role is not allowed here.",
  AlreadyRegistered: () => "This account is already registered.",
  NoApplication: () => "There is no pending application for this account.",
  ZeroAddress: () => "Please enter a valid address.",
  InvalidInput: () => "Some of the values are invalid. Check the form and try again.",
  BatchNotFound: ([id]) => `Batch #${id} does not exist.`,
  NotBatchManufacturer: () => "Only the batch's manufacturer can do this.",
  BatchNotActive: ([id, s]) => `Batch #${id} is ${BATCH_STATUS[Number(s)].toLowerCase()}; it cannot be shipped or dispensed.`,
  BatchExpired: ([id]) => `Batch #${id} has expired.`,
  TooManyStrips: () => "Too many strips for this batch or this transaction.",
  StripAlreadyRegistered: () => "One of these strip codes is already registered.",
  StripNotDispensable: () => "One of the scanned strips is unknown or already dispensed.",
  InsufficientBalance: ([, have, want]) => `Not enough stock: you hold ${have}, tried to use ${want}.`,
  InvalidRoute: ([from, to]) => `A ${ROLES[Number(from)]} cannot ship to a ${ROLES[Number(to)]}.`,
  ShipmentNotInTransit: () => "This shipment is no longer in transit.",
  NotShipmentParty: () => "You are not the sender or recipient of this shipment.",
  PrescriptionRequired: () => "This medicine is prescription-only. Enter a valid prescription ID.",
  PrescriptionNotUsable: ([id]) => `Prescription #${id} is cancelled, expired, used up, or its doctor is suspended.`,
  PatientMismatch: () => "This prescription belongs to a different patient.",
  NotPrescriber: () => "Only the doctor who issued this prescription can cancel it.",
  NotMonitor: () => "Only the cold-chain monitor or an admin can quarantine a batch.",
  AlreadyRecalled: () => "This batch is already recalled.",
  DeviceNotRegistered: () => "That smart box is not registered or is disabled.",
  EnforcedPause: () => "The network is paused by an admin.",
  UnknownDevice: () => "Unknown smart box.",
};

export function humanError(e) {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "Request rejected in wallet.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert?.data?.errorName;
    if (name && MESSAGES[name]) return MESSAGES[name](revert.data.args ?? []);
    if (name) return name;
    return e.shortMessage ?? e.message;
  }
  return e?.message ?? String(e);
}
