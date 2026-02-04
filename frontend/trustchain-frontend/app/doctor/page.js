"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  Stethoscope,
  FileSignature,
  UserPlus,
  Search,
  FileCheck,
  CheckCircle,
  XCircle,
  FileX
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import DoctorRegistryABI from "../../contracts/DoctorRegistry.json";
import PrescriptionABI from "../../contracts/Prescription.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function DoctorDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("PRESCRIPTIONS"); // PRESCRIPTIONS | PROFILE | CHECK

  // Forms
  const [profileForm, setProfileForm] = useState({ name: "", license: "" });
  const [prescriptionForm, setPrescriptionForm] = useState({ patientAddr: "", medsHash: "" });
  const [searchPrescriptionId, setSearchPrescriptionId] = useState("");

  useEffect(() => setMounted(true), []);

  // Contract Reads
  const { data: doctorInfo } = useReadContract({
    abi: DoctorRegistryABI,
    address: CONTRACT_ADDRESSES.doctorRegistry,
    functionName: "getDoctor",
    args: address ? [address] : undefined,
  });

  const { data: isApproved } = useReadContract({
    abi: DoctorRegistryABI,
    address: CONTRACT_ADDRESSES.doctorRegistry,
    functionName: "isApprovedDoctor",
    args: address ? [address] : undefined,
  });

  const { data: presData, refetch: fetchPrescription } = useReadContract({
    abi: PrescriptionABI,
    address: CONTRACT_ADDRESSES.prescription,
    functionName: "getPrescription",
    args: searchPrescriptionId ? [Number(searchPrescriptionId)] : undefined,
    query: { enabled: false }
  });

  const { data: isPresValid, refetch: fetchValidity } = useReadContract({
    abi: PrescriptionABI,
    address: CONTRACT_ADDRESSES.prescription,
    functionName: "isPrescriptionValid",
    args: searchPrescriptionId ? [Number(searchPrescriptionId)] : undefined,
    query: { enabled: false }
  });


  // Actions
  const handleApply = async () => {
    try {
      await writeContractAsync({
        abi: DoctorRegistryABI,
        address: CONTRACT_ADDRESSES.doctorRegistry,
        functionName: "applyAsDoctor",
        args: [profileForm.name, profileForm.license],
      });
      alert("✅ Application Submitted");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleUpdate = async () => {
    try {
      await writeContractAsync({
        abi: DoctorRegistryABI,
        address: CONTRACT_ADDRESSES.doctorRegistry,
        functionName: "updateDoctorDetails",
        args: [profileForm.name, profileForm.license],
      });
      alert("✏️ Details Updated");
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const handleCreatePrescription = async () => {
    try {
      await writeContractAsync({
        abi: PrescriptionABI,
        address: CONTRACT_ADDRESSES.prescription,
        functionName: "createPrescription",
        args: [prescriptionForm.patientAddr, prescriptionForm.medsHash],
      });
      alert("📝 Prescription Issued on Chain");
      setPrescriptionForm({ patientAddr: "", medsHash: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const handleCancelPrescription = async () => {
    if (!searchPrescriptionId) return;
    try {
      await writeContractAsync({
        abi: PrescriptionABI,
        address: CONTRACT_ADDRESSES.prescription,
        functionName: "cancelPrescription",
        args: [Number(searchPrescriptionId)],
      });
      alert("❌ Prescription Cancelled");
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  if (!mounted) return null;

  return (
    <DashboardLayout role="Doctor">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <Stethoscope className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your wallet to access Doctor Portal</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 🔹 HEADER STATS */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Doctor Status</p>
                <h3 className={`text-xl font-bold ${isApproved ? "text-green-400" : "text-yellow-400"}`}>
                  {isApproved ? "Authorized ✅" : "Pending Approval ⏳"}
                </h3>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isApproved ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                <Stethoscope className={`w-6 h-6 ${isApproved ? "text-green-500" : "text-yellow-500"}`} />
              </div>
            </div>
            <div className="glass p-6 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Registered Name</p>
                <h3 className="text-xl font-bold text-white">
                  {doctorInfo?.name || "Not Registered"}
                </h3>
              </div>
            </div>
          </div>

          {/* 🔹 TABS */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "PRESCRIPTIONS", label: "Issue Prescription", icon: FileSignature },
              { id: "CHECK", label: "Verify & Manage", icon: FileCheck },
              { id: "PROFILE", label: "Profile Settings", icon: UserPlus },
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

          {/* 🔹 PROFILE TAB */}
          {activeTab === "PROFILE" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6">Doctor Registration</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
                <input
                  type="text"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="License ID"
                  value={profileForm.license}
                  onChange={(e) => setProfileForm({ ...profileForm, license: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={handleApply}
                    className="w-full py-3 bg-blue-500 rounded-xl font-bold text-white hover:bg-blue-600 transition-all"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="w-full py-3 bg-white/10 rounded-xl font-bold text-white hover:bg-white/20 transition-all"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 ISSUE PRESCRIPTION TAB */}
          {activeTab === "PRESCRIPTIONS" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileSignature className="text-electric-blue" />
                New Prescription
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Patient Wallet Address</label>
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white font-mono"
                    placeholder="0x..."
                    value={prescriptionForm.patientAddr}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patientAddr: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Medicine List Hash (IPFS CID)</label>
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white font-mono"
                    placeholder="Qm..."
                    value={prescriptionForm.medsHash}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medsHash: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleCreatePrescription}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-electric-blue to-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25 transition-all"
                >
                  Issue on Blockchain
                </button>
              </div>
            </div>
          )}

          {/* 🔹 CHECK/VERIFY TAB */}
          {activeTab === "CHECK" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="number"
                    placeholder="Enter Prescription ID"
                    className="w-full bg-space-blue-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-electric-blue outline-none"
                    value={searchPrescriptionId}
                    onChange={(e) => setSearchPrescriptionId(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => { fetchPrescription(); fetchValidity(); }}
                  className="px-6 py-2.5 bg-electric-blue rounded-lg font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                >
                  Lookup
                </button>
              </div>

              {presData && (
                <div className="glass p-6 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold">Prescription #{searchPrescriptionId}</h3>
                    {isPresValid !== undefined && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-2 ${isPresValid ? "bg-green-500/10 border-green-500/50 text-green-400" : "bg-red-500/10 border-red-500/50 text-red-400"}`}>
                        {isPresValid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {isPresValid ? "VALID" : "INVALID / CANCELLED"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Patient</span>
                      <span className="font-mono">{presData.patient}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">IPFS Hash</span>
                      <span className="font-mono">{presData.medicineListHash}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Issue Date</span>
                      <span className="text-white">{new Date(Number(presData.createdAt) * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {presData.cancelled && (
                    <p className="mt-4 text-red-400 font-bold text-center">🚫 This prescription has been cancelled.</p>
                  )}

                  {!presData.cancelled && (
                    <button
                      onClick={handleCancelPrescription}
                      className="w-full mt-6 py-3 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <FileX className="w-5 h-5" />
                      Revoke / Cancel Prescription
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
