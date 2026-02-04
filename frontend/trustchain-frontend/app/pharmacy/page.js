"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  Pill,
  Download,
  ShoppingCart,
  Undo2,
  Stethoscope,
  Search,
  PackageCheck,
  AlertCircle
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PharmacyABI from "../../contracts/Pharmacy.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function PharmacyDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("RECEIVE"); // RECEIVE | DISPENSE | RETURN | EXPLORER

  // Forms
  const [receiveForm, setReceiveForm] = useState({ batchId: "", stripId: "", quantity: "" });
  const [dispenseForm, setDispenseForm] = useState({ prescriptionId: "", patientAddr: "", stripId: "", quantity: "" });
  const [returnForm, setReturnForm] = useState({ stripId: "", quantity: "" });

  // Search
  const [searchStripId, setSearchStripId] = useState("");

  useEffect(() => setMounted(true), []);

  // Contract Reads
  const { data: stockData, refetch: fetchStock, isError: isStockError } = useReadContract({
    abi: PharmacyABI,
    address: CONTRACT_ADDRESSES.pharmacy,
    functionName: "getStock",
    args: address && searchStripId ? [address, Number(searchStripId)] : undefined,
    query: { enabled: false }
  });

  // Actions
  const handleReceiveStock = async () => {
    try {
      await writeContractAsync({
        abi: PharmacyABI,
        address: CONTRACT_ADDRESSES.pharmacy,
        functionName: "receiveFromDistributor",
        args: [Number(receiveForm.batchId), Number(receiveForm.stripId), Number(receiveForm.quantity)],
      });
      alert("✅ Stock Received");
      setReceiveForm({ batchId: "", stripId: "", quantity: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDispense = async (withPrescription) => {
    try {
      if (withPrescription) {
        await writeContractAsync({
          abi: PharmacyABI,
          address: CONTRACT_ADDRESSES.pharmacy,
          functionName: "dispenseStrip",
          args: [Number(dispenseForm.prescriptionId), Number(dispenseForm.stripId), Number(dispenseForm.quantity)],
        });
      } else {
        await writeContractAsync({
          abi: PharmacyABI,
          address: CONTRACT_ADDRESSES.pharmacy,
          functionName: "dispenseWithoutPrescription",
          args: [dispenseForm.patientAddr, Number(dispenseForm.stripId), Number(dispenseForm.quantity)],
        });
      }
      alert(withPrescription ? "✅ Dispensed (Rx)" : "✅ Dispensed (OTC)");
      setDispenseForm({ prescriptionId: "", patientAddr: "", stripId: "", quantity: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleReturn = async (isPatient) => {
    try {
      await writeContractAsync({
        abi: PharmacyABI,
        address: CONTRACT_ADDRESSES.pharmacy,
        functionName: isPatient ? "returnMedicine" : "returnStock",
        args: [Number(returnForm.stripId), Number(returnForm.quantity)],
      });
      alert(isPatient ? "⚠️ Patient Return Processed" : "↩️ Stock Returned to Distributor");
      setReturnForm({ stripId: "", quantity: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  if (!mounted) return null;

  return (
    <DashboardLayout role="Pharmacy">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <Pill className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your designated pharmacy wallet</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 🔹 Tabs */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "RECEIVE", label: "Receive Stock", icon: Download },
              { id: "DISPENSE", label: "Dispense", icon: ShoppingCart },
              { id: "RETURN", label: "Returns", icon: Undo2 },
              { id: "EXPLORER", label: "Check Stock", icon: Search },
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

          {/* 🔹 RECEIVE TAB */}
          {activeTab === "RECEIVE" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <PackageCheck className="text-electric-blue" />
                Receive Inventory
              </h2>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Batch ID</label>
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                      value={receiveForm.batchId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, batchId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Strip ID</label>
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                      value={receiveForm.stripId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, stripId: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Quantity Receiving</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none"
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleReceiveStock}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-white shadow-lg shadow-green-500/25 transition-all"
                >
                  Update Inventory
                </button>
              </div>
            </div>
          )}

          {/* 🔹 DISPENSE TAB */}
          {activeTab === "DISPENSE" && (
            <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Rx Dispense */}
              <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-vivid-purple">
                  <Stethoscope className="w-5 h-5" /> Via Prescription
                </h3>
                <div className="space-y-3">
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                    placeholder="Prescription ID"
                    value={dispenseForm.prescriptionId}
                    onChange={(e) => setDispenseForm({ ...dispenseForm, prescriptionId: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                      placeholder="Strip ID"
                      value={dispenseForm.stripId}
                      onChange={(e) => setDispenseForm({ ...dispenseForm, stripId: e.target.value })}
                    />
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                      placeholder="Qty"
                      value={dispenseForm.quantity}
                      onChange={(e) => setDispenseForm({ ...dispenseForm, quantity: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => handleDispense(true)}
                    className="w-full py-3 bg-vivid-purple hover:bg-purple-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/25 transition-all"
                  >
                    Process Rx
                  </button>
                </div>
              </div>

              {/* OTC Dispense */}
              <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                  <ShoppingCart className="w-5 h-5" /> Over-The-Counter
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                    placeholder="Patient Address (0x...)"
                    value={dispenseForm.patientAddr}
                    onChange={(e) => setDispenseForm({ ...dispenseForm, patientAddr: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                      placeholder="Strip ID"
                      value={dispenseForm.stripId}
                      onChange={(e) => setDispenseForm({ ...dispenseForm, stripId: e.target.value })}
                    />
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                      placeholder="Qty"
                      value={dispenseForm.quantity}
                      onChange={(e) => setDispenseForm({ ...dispenseForm, quantity: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => handleDispense(false)}
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 rounded-xl font-bold text-white shadow-lg shadow-yellow-500/25 transition-all"
                  >
                    Process OTC
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 RETURNS TAB */}
          {activeTab === "RETURN" && (
            <div className="glass p-8 rounded-3xl border border-red-500/10 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <AlertCircle className="text-red-500" />
                Process Returns
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-red-500"
                    placeholder="Strip ID"
                    value={returnForm.stripId}
                    onChange={(e) => setReturnForm({ ...returnForm, stripId: e.target.value })}
                  />
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-red-500"
                    placeholder="Qty"
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => handleReturn(true)}
                    className="w-full py-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all"
                  >
                    Customer Return
                  </button>
                  <button
                    onClick={() => handleReturn(false)}
                    className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-white transition-all"
                  >
                    Return to Distributor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🔹 EXPLORER TAB */}
          {activeTab === "EXPLORER" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="number"
                    placeholder="Enter Strip ID to Check Stock"
                    className="w-full bg-space-blue-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-electric-blue outline-none"
                    value={searchStripId}
                    onChange={(e) => setSearchStripId(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => fetchStock()}
                  className="px-6 py-2.5 bg-electric-blue rounded-lg font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                >
                  Check
                </button>
              </div>

              {stockData && (
                <div className="glass p-6 rounded-2xl border border-white/10">
                  <h3 className="text-xl font-bold mb-4">Stock Details for Strip #{stockData.stripId?.toString()}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl text-center">
                      <p className="text-xs text-gray-400 uppercase">Available Qty</p>
                      <p className="text-2xl font-bold text-green-400">{stockData.availableQuantity?.toString()}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl text-center">
                      <p className="text-xs text-gray-400 uppercase">Returned Qty</p>
                      <p className="text-2xl font-bold text-red-400">{stockData.returnedQuantity?.toString()}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl text-center">
                      <p className="text-xs text-gray-400 uppercase">Batch ID</p>
                      <p className="text-xl font-mono">{stockData.batchId?.toString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
