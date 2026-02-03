"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    ShieldCheck,
    Activity,
    Truck,
    Stethoscope,
    Pill,
    Menu,
    X
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const sidebarItems = [
    { name: "Manufacturer", href: "/manufacturer", icon: Activity },
    { name: "Distributor", href: "/distributor", icon: Truck },
    { name: "Pharmacy", href: "/pharmacy", icon: Pill },
    { name: "Doctor", href: "/doctor", icon: Stethoscope },
    { name: "Admin", href: "/admin", icon: ShieldCheck },
];

export default function DashboardLayout({ children, role = "User" }) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-space-blue-900 text-white font-sans selection:bg-electric-blue selection:text-white flex">

            {/* 🔹 Sidebar (Desktop) */}
            <aside className="hidden lg:flex flex-col w-64 fixed h-full border-r border-white/5 bg-space-blue-900/50 backdrop-blur-xl z-20">
                <div className="p-6 border-b border-white/5 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-electric-blue to-vivid-purple rounded-lg flex items-center justify-center shadow-lg shadow-electric-blue/20">
                        <ShieldCheck className="text-white w-5 h-5" />
                    </div>
                    <span className="text-xl font-bold font-heading tracking-tight">TrustChain</span>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-1">
                    <p className="text-xs font-bold text-gray-500 uppercase px-3 mb-2 mt-4">Dashboards</p>
                    {sidebarItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? "bg-electric-blue/10 text-electric-blue border border-electric-blue/20"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </div>

                <div className="p-4 border-t border-white/5">
                    <Link href="/" className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white text-sm font-medium hover:bg-white/5 rounded-lg transition-all">
                        <LogOut className="w-5 h-5" />
                        Back to Home
                    </Link>
                </div>
            </aside>

            {/* 🔹 Mobile Header */}
            <div className="lg:hidden fixed top-0 w-full z-30 bg-space-blue-900/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-electric-blue w-6 h-6" />
                    <span className="text-lg font-bold font-heading">TrustChain</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/5 rounded-lg">
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* 🔹 Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="lg:hidden fixed inset-0 z-20 bg-space-blue-900 pt-20 px-6"
                    >
                        <div className="space-y-2">
                            {sidebarItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-lg font-medium"
                                >
                                    <item.icon className="w-5 h-5 text-electric-blue" />
                                    {item.name}
                                </Link>
                            ))}
                            <Link
                                href="/"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-gray-400 text-lg font-medium mt-4"
                            >
                                <LogOut className="w-5 h-5" />
                                Exit App
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* 🔹 Main Content User Wrapper */}
            <main className="flex-1 lg:ml-64 relative">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-space-blue-900/80 backdrop-blur-md border-b border-white/5 h-20 px-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold font-heading">{role} Dashboard</h1>
                        <p className="text-xs text-gray-500">Manage your supply chain operations</p>
                    </div>
                    <ConnectButton showBalance={false} />
                </header>

                {/* Content */}
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>

        </div>
    );
}
