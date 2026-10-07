"use client";
import { Boxes, Gauge, PlusCircle, Truck } from "lucide-react";
import Workspace from "@/components/Workspace";

const nav = [
  { href: "/manufacturer", label: "Overview", icon: Gauge, exact: true },
  { href: "/manufacturer/batches/new", label: "New batch", short: "New", icon: PlusCircle, exact: true },
  { href: "/manufacturer/batches", label: "Batches", icon: Boxes },
  { href: "/manufacturer/shipments", label: "Shipments", icon: Truck },
];

export default function Layout({ children }) {
  return (
    <Workspace roleKey="manufacturer" nav={nav}>
      {children}
    </Workspace>
  );
}
