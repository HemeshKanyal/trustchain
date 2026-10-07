import { Factory, HeartPulse, Pill, ShieldCheck, Stethoscope, Truck } from "lucide-react";

/** The six ways into the app. `role` = TrustChain.Role enum value (patients have none). */
export const ROLE_META = {
  admin: { key: "admin", role: 1, title: "Regulator", plural: "regulators", icon: ShieldCheck, home: "/admin", blurb: "Approve organisations, register smart boxes, hold, release or recall batches." },
  manufacturer: { key: "manufacturer", role: 2, title: "Manufacturer", plural: "manufacturers", icon: Factory, home: "/manufacturer", blurb: "Create batches, print strip QR codes, ship to distributors, recall." },
  distributor: { key: "distributor", role: 3, title: "Distributor", plural: "distributors", icon: Truck, home: "/distributor", blurb: "Receive, store and move stock in monitored smart boxes." },
  pharmacy: { key: "pharmacy", role: 4, title: "Pharmacy", plural: "pharmacies", icon: Pill, home: "/pharmacy", blurb: "Scan strips at the counter and dispense against prescriptions." },
  doctor: { key: "doctor", role: 5, title: "Doctor", plural: "doctors", icon: Stethoscope, home: "/doctor", blurb: "Write prescriptions that pharmacies can verify." },
  patient: { key: "patient", role: 0, title: "Patient", plural: "patients", icon: HeartPulse, home: "/me", blurb: "See the medicines dispensed to you and get recall alerts." },
};

export const ROLE_ORDER = ["manufacturer", "distributor", "pharmacy", "doctor", "admin", "patient"];
export const roleKeyOf = (n) => Object.values(ROLE_META).find((m) => m.role === Number(n) && m.role !== 0)?.key ?? null;
