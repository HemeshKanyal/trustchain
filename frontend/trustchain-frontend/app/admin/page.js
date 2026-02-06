"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { motion } from "framer-motion";
import { ShieldCheck, UserCheck, UserX, AlertCircle, CheckCircle, Search, Activity, Trash2, Plus } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import AdminABI from "../../contracts-data/Admin.json";
import { CONTRACT_ADDRESSES } from "../../contracts-data/addresses";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const { writeContractAsync } = useWriteContract();

  // Local state for inputs
  const [targetAddress, setTargetAddress] = useState("");
  const [activeTab, setActiveTab] = useState("MANUFACTURER"); // MANUFACTURER | DISTRIBUTOR | PHARMACY | DOCTOR

  useEffect(() => setMounted(true), []);

  const handleAction = async (actionType) => {
    if (!targetAddress || targetAddress.length !== 42) {
      alert("Please enter a valid Ethereum address (42 chars)");
      return;
    }

    const roleMap = {
      "MANUFACTURER": 2,
      "DISTRIBUTOR": 3,
      "PHARMACY": 4,
      "DOCTOR": 5
    };

    const roleEnum = roleMap[activeTab];
    if (!roleEnum) {
      alert("Invalid Role Selected");
      return;
    }

    try {
      if (actionType === "approve") {
        // registerUser(address, name, role, location)
        await writeContractAsync({
          abi: AdminABI,
          address: CONTRACT_ADDRESSES.admin,
          functionName: "registerUser",
          args: [targetAddress, `Approved ${activeTab}`, roleEnum, "System Registered"],
        });
        alert(`User Registered as ${activeTab}`);
      } else if (actionType === "revoke") {
        await writeContractAsync({
          abi: AdminABI,
          address: CONTRACT_ADDRESSES.admin,
          functionName: "revokeUser",
          args: [targetAddress],
        });
        alert(`User Revoked from ${activeTab}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleBlacklist = async (isBlocking) => {
    if (!targetAddress) return;
    try {
      await writeContractAsync({
        abi: AdminABI,
        address: CONTRACT_ADDRESSES.admin,
        functionName: isBlocking ? "blacklistAddress" : "removeFromBlacklist",
        args: [targetAddress],
      });
      alert(isBlocking ? "Address Blacklisted" : "Address Removed from Blacklist");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  if (!mounted) return null;

  const tabs = ["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "DOCTOR"];

  return (
    <DashboardLayout role="Admin">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your wallet to access Admin Panel</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 🔹 Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-8 bg-electric-blue/10 rounded-full blur-2xl group-hover:bg-electric-blue/20 transition-all" />
              <h3 className="text-gray-400 font-medium mb-1">Network Status</h3>
              <p className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Active
              </p>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-8 bg-vivid-purple/10 rounded-full blur-2xl group-hover:bg-vivid-purple/20 transition-all" />
              <h3 className="text-gray-400 font-medium mb-1">Your Role</h3>
              <p className="text-2xl font-bold text-white">Super Admin</p>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-8 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all" />
              <h3 className="text-gray-400 font-medium mb-1">Pending Actions</h3>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>

          {/* 🔹 User Management Section */}
          <div className="glass rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-heading">User Management</h2>
                <p className="text-sm text-gray-400">Authorize or revoke roles in the supply chain</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-medium transition-all relative ${activeTab === tab ? "text-electric-blue bg-white/5" : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                  {tab}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-electric-blue" />}
                </button>
              ))}
            </div>

            {/* Actions Area */}
            <div className="p-8">
              <div className="max-w-2xl">
                <label className="block text-sm text-gray-400 mb-2">Target Ethereum Address</label>
                <div className="flex gap-4 mb-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="0x..."
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none font-mono"
                      value={targetAddress}
                      onChange={(e) => setTargetAddress(e.target.value)}
                    />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Available Actions for {activeTab}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleAction("approve")}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold">Approve Role</p>
                      <p className="text-xs text-green-400">Grant {activeTab.toLowerCase()} permissions</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction("revoke")}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserX className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold">Revoke Role</p>
                      <p className="text-xs text-red-400">Remove permissions immediately</p>
                    </div>
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5">
                  <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Danger Zone</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleBlacklist(true)}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium border border-gray-700 transition-all"
                    >
                      Blacklist Address
                    </button>
                    <button
                      onClick={() => handleBlacklist(false)}
                      className="px-4 py-2 rounded-lg bg-transparent hover:bg-white/5 text-gray-500 text-sm font-medium border border-white/10 transition-all"
                    >
                      Remove Blacklist
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
