"use client";
import { ClipboardList, FilePlus2, Users } from "lucide-react";
import Workspace from "@/components/Workspace";

const nav = [
  { href: "/doctor", label: "New prescription", short: "New", icon: FilePlus2, exact: true },
  { href: "/doctor/prescriptions", label: "Prescriptions", short: "Issued", icon: ClipboardList },
  { href: "/doctor/patients", label: "Patients", icon: Users },
];

export default function Layout({ children }) {
  return <Workspace roleKey="doctor" nav={nav}>{children}</Workspace>;
}
