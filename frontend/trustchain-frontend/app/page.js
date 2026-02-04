"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { ShieldCheck, Pill, Truck, Search, Activity, User } from "lucide-react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import AdminABI from "../contracts/Admin.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [checkAddress, setCheckAddress] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Verification Logic
  const { data: isApproved, isLoading, error } = useReadContract({
    abi: AdminABI,
    address: CONTRACT_ADDRESSES.admin,
    functionName: "approvedManufacturers",
    args: [
      checkAddress && checkAddress.length === 42
        ? checkAddress.trim()
        : "0x0000000000000000000000000000000000000000",
    ],
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-space-blue-900 text-white font-sans selection:bg-electric-blue selection:text-white overflow-hidden">

      {/* 🔹 Navigation Bar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-space-blue-900/80 backdrop-blur-md shadow-lg" : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-electric-blue to-vivid-purple rounded-xl flex items-center justify-center shadow-lg shadow-electric-blue/20">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold font-heading tracking-tight">TrustChain</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#verify" className="hover:text-white transition-colors">Verify</a>
            <a href="#network" className="hover:text-white transition-colors">Network</a>
          </div>

          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;
              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button onClick={openConnectModal} className="px-5 py-2.5 bg-electric-blue hover:bg-blue-600 rounded-lg text-white font-medium transition-all shadow-lg shadow-blue-500/25">
                          Connect Wallet
                        </button>
                      );
                    }
                    return (
                      <button onClick={openAccountModal} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md border border-white/5 transition-all">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        {account.displayName}
                      </button>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>

      {/* 🔹 Hero Section */}
      <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="relative z-10 md:w-1/2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vivid-purple/10 border border-vivid-purple/20 text-vivid-purple text-sm font-medium mb-6">
              <span className="flex h-2 w-2 rounded-full bg-vivid-purple"></span>
              Live on Chain (Hardhat/Local)
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-heading leading-tight mb-6">
              The Future of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-vivid-purple">
                Pharma Trust
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-lg leading-relaxed">
              Eliminate counterfeits with an immutable, blockchain-powered supply chain. Track medicine from manufacturer to patient in real-time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link href="/patient" className="px-8 py-4 bg-gradient-to-r from-electric-blue to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all text-center">
              I am a Patient
            </Link>
            <a href="#network" className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-center">
              Supply Chain Partner
            </a>
          </motion.div>
        </div>

        {/* 3D/Graphic Placeholder - Using CSS Shapes for now */}
        <div className="md:w-1/2 relative h-[500px] w-full flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-electric-blue/20 to-vivid-purple/20 rounded-full blur-[100px]" />
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="relative z-10 glass p-8 rounded-3xl border border-white/20 w-80 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="h-3 w-20 bg-gray-600/50 rounded-full" />
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="w-10 h-10 rounded-lg bg-electric-blue/20 flex items-center justify-center">
                    <Pill className="text-electric-blue w-5 h-5" />
                  </div>
                  <div>
                    <div className="h-2 w-24 bg-gray-500/50 rounded mb-2" />
                    <div className="h-2 w-16 bg-gray-600/50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 🔹 How it Works */}
      <section id="network" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
            Select Your Role
          </h2>
          <p className="text-gray-400">Access your designated supply chain portal.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { title: "Manufacturer", icon: Activity, desc: "Create & Tag Batches", link: "/manufacturer" },
            { title: "Distributor", icon: Truck, desc: "Secure Transport", link: "/distributor" },
            { title: "Pharmacy", icon: ShieldCheck, desc: "Verify & Dispense", link: "/pharmacy" },
            { title: "Doctor", icon: User, desc: "Prescribe & Monitor", link: "/doctor" },
          ].map((item, idx) => (
            <Link key={idx} href={item.link} className="glass p-6 rounded-2xl flex flex-col items-center text-center hover:bg-white/10 hover:scale-105 transition-all cursor-pointer border border-white/5 group">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center mb-6 shadow-inner border border-white/5 group-hover:border-electric-blue/50 transition-colors">
                <item.icon className="w-8 h-8 text-electric-blue group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm group-hover:text-gray-300">{item.desc}</p>
            </Link>
          ))}
        </div>

        {/* Admin Link (Discrete) */}
        <div className="mt-12 text-center">
          <Link href="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Authorized Admin Access
          </Link>
        </div>
      </section>

      {/* 🔹 Verification Tool */}
      <section id="verify" className="py-20 px-6 max-w-4xl mx-auto">
        <div className="glass p-8 md:p-12 rounded-3xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-electric-blue/10 bg-blur-[100px] rounded-full pointer-events-none" />

          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold font-heading mb-4">Verify Authenticity</h2>
            <p className="text-gray-400">Enter a manufacturer address to check their approval status on the blockchain.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="0x..."
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                className="w-full bg-space-blue-800 text-white pl-12 pr-4 py-4 rounded-xl border border-gray-700 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all placeholder:text-gray-600 font-mono"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            {checkAddress && checkAddress.length === 42 ? (
              isLoading ? (
                <div className="flex items-center gap-2 text-electric-blue animate-pulse">
                  <Activity className="w-5 h-5" /> verifyng on-chain...
                </div>
              ) : (
                <div className={`flex items-center gap-3 px-6 py-3 rounded-full border ${isApproved ? "bg-green-500/10 border-green-500/50 text-green-400" : "bg-red-500/10 border-red-500/50 text-red-400"}`}>
                  {isApproved ? (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span className="font-bold">Authorized Manufacturer</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span className="font-bold">Not Authorized / Unknown</span>
                    </>
                  )}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-600">Enter a valid Ethereum address (42 characters)</p>
            )}

            {error && (
              <p className="text-red-400 text-sm mt-4 text-center">Error connecting to network: {error.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* 🔹 Footer */}
      <footer className="py-10 border-t border-white/5 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} TrustChain. Built for the future.</p>
      </footer>
    </div>
  );
}
