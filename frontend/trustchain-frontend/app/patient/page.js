"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  User,
  History,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  Pill,
  Search
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PatientABI from "../../contracts/Patient.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function PatientDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("VERIFY"); // VERIFY | HISTORY | PROFILE

  // Forms
  const [verifyForm, setVerifyForm] = useState({ stripId: "", prescriptionId: "0" }); // "0" for OTC
  const [historyStripId, setHistoryStripId] = useState("");

  // States to hold check results
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => setMounted(true), []);

  // Contract Reads
  const { data: isRegistered, refetch: fetchRegistration } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "isPatientRegistered",
    args: address ? [address] : undefined,
  });

  const { data: dispensedData, refetch: fetchDispensed } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "getPatientStripHistory",
    args: historyStripId && address ? [address, Number(historyStripId)] : undefined,
    query: { enabled: false }
  });

  const { data: verifyData, refetch: fetchVerify } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "verifyStrip",
    args:
      verifyForm.stripId
        ? [address, Number(verifyForm.stripId), Number(verifyForm.prescriptionId || 0)]
        : undefined,
    query: { enabled: false }
  });


  // Actions
  const handleRegister = async () => {
    try {
      await writeContractAsync({
        abi: PatientABI,
        address: CONTRACT_ADDRESSES.patient,
        functionName: "registerPatient",
        args: [],
      });
      alert("✅ Patient Account Registered");
      fetchRegistration();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDeregister = async () => {
    try {
      await writeContractAsync({
        abi: PatientABI,
        address: CONTRACT_ADDRESSES.patient,
        functionName: "deregisterPatient",
        args: [],
      });
      alert("Account Deregistered");
      fetchRegistration();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const handleVerify = async () => {
    const { data } = await fetchVerify();
    if (data) {
      setVerificationResult({
        isValid: data[0],
        message: data[1]
      });
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
                  <p className="text-sm text-gray-400">Register to track your medical history on-chain.</p>
                </div>
              </div>
              <button
                onClick={handleRegister}
                className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Register Now
              </button>
            </div>
          )}

          {/* 🔹 TABS */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "VERIFY", label: "Verify Medicine", icon: ShieldCheck },
              { id: "HISTORY", label: "My Medicine History", icon: History },
              { id: "PROFILE", label: "Account Settings", icon: User },
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
                Instantly check if your medicine is authentic and safe to consume.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Strip ID (on packaging)</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                    value={verifyForm.stripId}
                    onChange={(e) => setVerifyForm({ ...verifyForm, stripId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Prescription ID (Optional)</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                    placeholder="0 if OTC"
                    value={verifyForm.prescriptionId}
                    onChange={(e) => setVerifyForm({ ...verifyForm, prescriptionId: e.target.value })}
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
                <div className={`mt-6 p-4 rounded-xl border ${verificationResult.isValid ? "bg-green-500/10 border-green-500/50" : "bg-red-500/10 border-red-500/50"}`}>
                  <h3 className={`font-bold flex items-center gap-2 ${verificationResult.isValid ? "text-green-400" : "text-red-400"}`}>
                    {verificationResult.isValid ? "✅ Authentic Product" : "❌ Verification Failed"}
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">{verificationResult.message}</p>
                </div>
              )}
            </div>
          )}

          {/* 🔹 HISTORY TAB */}
          {activeTab === "HISTORY" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="number"
                    placeholder="Enter Strip ID to Check History"
                    className="w-full bg-space-blue-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-electric-blue outline-none"
                    value={historyStripId}
                    onChange={(e) => setHistoryStripId(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => fetchDispensed()}
                  className="px-6 py-2.5 bg-electric-blue rounded-lg font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                >
                  Search
                </button>
              </div>

              {dispensedData && (
                <div className="glass p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Pill className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Strip #{historyStripId}</h3>
                      <p className="text-sm text-gray-400">Personal Consumption Record</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm">Total Quantity Dispensed to You</p>
                    <p className="text-3xl font-bold text-white mt-1">{dispensedData.toString()}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🔹 PROFILE TAB */}
          {activeTab === "PROFILE" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6">Patient Settings</h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <span className="text-gray-300">Registration Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isRegistered ? "bg-green-500/20 text-green-500" : "bg-gray-700 text-gray-400"}`}>
                    {isRegistered ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                {isRegistered && (
                  <button
                    onClick={handleDeregister}
                    className="w-full py-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Deregister Account
                  </button>
                )}

                {!isRegistered && (
                  <button
                    onClick={handleRegister}
                    className="w-full py-3 bg-blue-500 rounded-xl font-bold text-white hover:bg-blue-600 transition-all"
                  >
                    Register Account
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
