"use client";
import { Kanban, PackageOpen, Truck, Warehouse } from "lucide-react";
import Workspace from "@/components/Workspace";
import { useMe, useShipmentsOf } from "@/lib/hooks";

export default function Layout({ children }) {
  const me = useMe();
  const ships = useShipmentsOf(me.address);
  const arriving = (ships.data ?? []).filter((s) => s.to.toLowerCase() === me.address?.toLowerCase() && s.status === 1).length;
  const nav = [
    { href: "/distributor", label: "Board", icon: Kanban, exact: true },
    { href: "/distributor/arriving", label: "Arriving", icon: PackageOpen, count: arriving },
    { href: "/distributor/inventory", label: "Warehouse", icon: Warehouse },
    { href: "/distributor/road", label: "On the road", short: "Road", icon: Truck },
  ];
  return <Workspace roleKey="distributor" nav={nav}>{children}</Workspace>;
}
