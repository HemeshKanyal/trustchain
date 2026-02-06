"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract, usePublicClient } from "wagmi";
import {
  User,
  History,
  ShieldCheck,
  AlertTriangle,
  Pill,
  Search,
  CheckCircle,
  XCircle
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PatientABI from "../../contracts-data/Patient.json"; // Unified ABI
import { CONTRACT_ADDRESSES } from "../../contracts-data/addresses";

export default function PatientDashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("VERIFY"); // VERIFY | SETTINGS

  // Forms
  const [verifyForm, setVerifyForm] = useState({ stripId: "" });
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => setMounted(true), []);

  // Contract Reads
  // Check Registration Status
  const { data: userData } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "users",
    args: address ? [address] : undefined,
  });

  // userData: [name, role, wallet, isRegistered, location]
  // Role 6 is Patient
  const isRegistered = userData && Number(userData[1]) === 6 && userData[3];
  const patientName = userData ? userData[0] : "Guest";

  // Contract Writes
  const { writeContractAsync } = useWriteContract();

  // Actions
  const handleRegister = async () => {
    try {
      await writeContractAsync({
        abi: PatientABI,
        address: CONTRACT_ADDRESSES.patient,
        functionName: "registerPatient",
        args: ["Self-Registered Patient", 30], // Simple default or add form
      });
      alert("✅ Patient Account Registered");
      fetchRegistration();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const { data: stripData, refetch: verifyStrip } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "verifyStrip",
    args: verifyForm.stripId ? [Number(verifyForm.stripId)] : undefined,
    query: { enabled: false }
  });

  // Actions
  const handleVerify = async () => {
    if (!verifyForm.stripId) return;
    const { data } = await verifyStrip();

    // verifyStrip returns (address manufacturer, uint256 expiryDate, bool isSold)
    if (data) {
      const manufacturerAddr = data[0];
      const expiry = new Date(Number(data[1]) * 1000).toLocaleDateString();
      const isSold = data[2];

      setVerificationResult({
        isValid: manufacturerAddr !== "0x0000000000000000000000000000000000000000",
        manufacturer: manufacturerAddr,
        expiry: expiry,
        isSold: isSold,
        message: manufacturerAddr !== "0x0000000000000000000000000000000000000000"
          ? "✅ Licensed Manufacturer"
          : "❌ Invalid / Fake Strip"
      });
    } else {
      setVerificationResult(null);
    }
  }

  if (!mounted) return null;

  return (
    <DashboardLayout role="Patient">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <User className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your wallet to access Patient Portal</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 🔹 Registration Alert */}
          {!isRegistered && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-yellow-500" />
                <div>
                  <h3 className="font-bold text-yellow-500">Account Not Registered</h3>
                  <p className="text-sm text-gray-400">Please contact a System Administrator to register as a Patient.</p>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 TABS */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "VERIFY", label: "Verify Medicine", icon: ShieldCheck },
              { id: "SETTINGS", label: "Account Settings", icon: User },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                  ? "bg-electric-blue text-white shadow-lg shadow-electric-blue/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 🔹 VERIFY TAB */}
          {activeTab === "VERIFY" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <ShieldCheck className="text-electric-blue" />
                Verify Authenticity
              </h2>
              <p className="text-gray-400 mb-6 text-sm">
                Enter the Strip ID found on your medicine packaging.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Strip ID</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                    value={verifyForm.stripId}
                    onChange={(e) => setVerifyForm({ ...verifyForm, stripId: e.target.value })}
                  />
                </div>

                <button
                  onClick={handleVerify}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-white shadow-lg shadow-green-500/25 transition-all"
                >
                  Verify with TrustChain
                </button>
              </div>

              {verificationResult && (
                <div className={`mt-6 p-6 rounded-xl border ${verificationResult.isValid ? "bg-green-500/10 border-green-500/50" : "bg-red-500/10 border-red-500/50"}`}>
                  <h3 className={`font-bold text-lg flex items-center gap-2 ${verificationResult.isValid ? "text-green-400" : "text-red-400"}`}>
                    {verificationResult.isValid ? <CheckCircle /> : <XCircle />}
                    {verificationResult.message}
                  </h3>

                  {verificationResult.isValid && (
                    <div className="mt-4 space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Manufacturer</span>
                        <span className="font-mono">{verificationResult.manufacturer.slice(0, 10)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expiry Date</span>
                        <span className="text-white">{verificationResult.expiry}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className={verificationResult.isSold ? "text-blue-400 font-bold" : "text-yellow-400 font-bold"}>
                          {verificationResult.isSold ? "SOLD / DISPENSED" : "IN STOCK / AVAILABLE"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 🔹 SETTINGS TAB */}
          {activeTab === "SETTINGS" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6">Patient Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <span className="text-gray-300">Name</span>
                  <span className="font-bold text-white">{patientName}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <span className="text-gray-300">Registration Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isRegistered ? "bg-green-500/20 text-green-500" : "bg-gray-700 text-gray-400"}`}>
                    {isRegistered ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                <p className="text-xs text-center text-gray-500 mt-8">
                  To update your details or deregister, please visit the Administration office.
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
