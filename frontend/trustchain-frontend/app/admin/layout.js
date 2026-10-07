"use client";
import { Bell, Boxes, BrainCircuit, Building2, ClipboardCheck, FlaskConical, Gauge, Radio, Settings } from "lucide-react";
import Workspace from "@/components/Workspace";
import { useApplications } from "@/lib/hooks";

export default function AdminLayout({ children }) {
  const apps = useApplications();
  const nav = [
    { href: "/admin", label: "Overview", icon: Gauge, exact: true },
    { href: "/admin/ai", label: "AI risk", short: "AI", icon: BrainCircuit },
    { href: "/admin/applications", label: "Applications", short: "Apps", icon: ClipboardCheck, count: apps.data?.length },
    { href: "/admin/organisations", label: "Organisations", short: "Orgs", icon: Building2 },
    { href: "/admin/batches", label: "Batches", icon: Boxes },
    { href: "/admin/alerts", label: "Recalls & alerts", short: "Alerts", icon: Bell },
    { href: "/admin/devices", label: "Smart boxes", short: "Boxes", icon: Radio },
    { href: "/admin/system", label: "System", icon: Settings },
    { href: "/admin/simulation", label: "Simulation", short: "Sim", icon: FlaskConical },
  ];
  return (
    <Workspace roleKey="admin" nav={nav}>
      {children}
    </Workspace>
  );
}
