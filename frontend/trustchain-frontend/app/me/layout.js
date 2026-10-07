"use client";
import { ClipboardList, HeartPulse, QrCode } from "lucide-react";
import Workspace from "@/components/Workspace";

const nav = [
  { href: "/me", label: "My cabinet", short: "Cabinet", icon: HeartPulse, exact: true },
  { href: "/me/prescriptions", label: "Prescriptions", short: "Rx", icon: ClipboardList },
  { href: "/me/qr", label: "My wallet QR", short: "QR", icon: QrCode },
];

export default function Layout({ children }) {
  return <Workspace roleKey="patient" nav={nav}>{children}</Workspace>;
}
