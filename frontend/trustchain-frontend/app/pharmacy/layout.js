"use client";
import { BrainCircuit, PackageOpen, ReceiptText, ScanLine, Warehouse } from "lucide-react";
import Workspace from "@/components/Workspace";
import { useMe, useShipmentsOf } from "@/lib/hooks";

export default function Layout({ children }) {
  const me = useMe();
  const ships = useShipmentsOf(me.address);
  const arriving = (ships.data ?? []).filter((s) => s.to.toLowerCase() === me.address?.toLowerCase() && s.status === 1).length;
  const nav = [
    { href: "/pharmacy", label: "Counter", icon: ScanLine, exact: true },
    { href: "/pharmacy/arriving", label: "Arriving", icon: PackageOpen, count: arriving },
    { href: "/pharmacy/shelf", label: "Shelf", icon: Warehouse },
    { href: "/pharmacy/sales", label: "Sales", icon: ReceiptText },
    { href: "/pharmacy/forecast", label: "Forecast", icon: BrainCircuit },
  ];
  return <Workspace roleKey="pharmacy" nav={nav}>{children}</Workspace>;
}
