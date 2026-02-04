"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  Truck,
  MapPin,
  PackageCheck,
  Navigation,
  Search,
  ClipboardList,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import DistributorABI from "../../contracts/Distributor.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function DistributorDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("RECEIVE"); // RECEIVE | TRANSIT | CHECKPOINT | EXPLORER

  // Forms
  const [receiveBatchId, setReceiveBatchId] = useState("");
  const [transitForm, setTransitForm] = useState({ batchId: "", recipient: "" });
  const [checkpointForm, setCheckpointForm] = useState({ transitId: "", location: "", metadata: "" });
  const [completeTransitId, setCompleteTransitId] = useState("");

  // Search
  const [searchTransitId, setSearchTransitId] = useState("");

  useEffect(() => setMounted(true), []);

  // Contract Reads
  const { data: transitData, refetch: fetchTransit, isError: isTransitError } = useReadContract({
    abi: DistributorABI,
    address: CONTRACT_ADDRESSES.distributor,
    functionName: "getTransit",
    args: searchTransitId ? [Number(searchTransitId)] : undefined,
    query: { enabled: false }
  });

  const { data: checkpointCount, refetch: fetchCheckpointCount } = useReadContract({
    abi: DistributorABI,
    address: CONTRACT_ADDRESSES.distributor,
    functionName: "getCheckpointCount",
    args: searchTransitId ? [Number(searchTransitId)] : undefined,
    query: { enabled: false }
  });


  // Actions
  const handleReceive = async () => {
    try {
      await writeContractAsync({
        abi: DistributorABI,
        address: CONTRACT_ADDRESSES.distributor,
        functionName: "receiveFromManufacturer",
        args: [Number(receiveBatchId)],
      });
      alert("✅ Batch Received Successfully");
      setReceiveBatchId("");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleStartTransit = async () => {
    try {
      await writeContractAsync({
        abi: DistributorABI,
        address: CONTRACT_ADDRESSES.distributor,
        functionName: "startTransit",
        args: [Number(transitForm.batchId), transitForm.recipient],
      });
      alert("🚚 Transit Started");
      setTransitForm({ batchId: "", recipient: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleRecordCheckpoint = async () => {
    try {
      await writeContractAsync({
        abi: DistributorABI,
        address: CONTRACT_ADDRESSES.distributor,
        functionName: "recordCheckpoint",
        args: [
          Number(checkpointForm.transitId),
          checkpointForm.location,
          checkpointForm.metadata
        ],
      });
      alert("📍 Checkpoint Recorded");
      setCheckpointForm({ transitId: "", location: "", metadata: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const handleCompleteTransit = async () => {
    try {
      await writeContractAsync({
        abi: DistributorABI,
        address: CONTRACT_ADDRESSES.distributor,
        functionName: "completeTransit",
        args: [Number(completeTransitId)],
      });
      alert("✅ Transit Completed");
      setCompleteTransitId("");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };


  if (!mounted) return null;

  return (
    <DashboardLayout role="Distributor">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <Truck className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your designated distributor wallet</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 🔹 Navigation Tabs */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "RECEIVE", label: "Receive Batch", icon: PackageCheck },
              { id: "TRANSIT", label: "Start Transit", icon: Navigation },
              { id: "CHECKPOINT", label: "Update Status", icon: MapPin },
              { id: "EXPLORER", label: "Transit Explorer", icon: Search },
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
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <PackageCheck className="text-electric-blue" />
                Confirm Receipt
              </h2>
              <p className="text-gray-400 mb-6 text-sm">
                Acknowledge physical receipt of a batch from a manufacturer. This transfers chain of custody to you.
              </p>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Batch ID</label>
                <input
                  type="number"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none transition-colors mb-4"
                  placeholder="e.g. 101"
                  value={receiveBatchId}
                  onChange={(e) => setReceiveBatchId(e.target.value)}
                />
                <button
                  onClick={handleReceive}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-white shadow-lg shadow-green-500/25 transition-all"
                >
                  Confirm Receipt on Chain
                </button>
              </div>
            </div>
          )}

          {/* 🔹 START TRANSIT TAB */}
          {activeTab === "TRANSIT" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Truck className="text-vivid-purple" />
                Initiate Stewardship
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Batch ID</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none"
                    placeholder="Batch ID"
                    value={transitForm.batchId}
                    onChange={(e) => setTransitForm({ ...transitForm, batchId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Recipient Address (Pharmacy/Doctor)</label>
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none font-mono"
                    placeholder="0x..."
                    value={transitForm.recipient}
                    onChange={(e) => setTransitForm({ ...transitForm, recipient: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleStartTransit}
                  className="w-full py-4 mt-2 bg-gradient-to-r from-vivid-purple to-purple-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                >
                  Start Shipping Transit
                </button>
              </div>
            </div>
          )}

          {/* 🔹 CHECKPOINT / UPDATE TAB */}
          {activeTab === "CHECKPOINT" && (
            <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Record Checkpoint */}
              <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                  <MapPin className="w-5 h-5" /> Travel Checkpoint
                </h3>
                <div className="space-y-3">
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                    placeholder="Transit ID"
                    value={checkpointForm.transitId}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, transitId: e.target.value })}
                  />
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                    placeholder="Current Location"
                    value={checkpointForm.location}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, location: e.target.value })}
                  />
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white"
                    placeholder="Metadata (Temp, Humidity)"
                    value={checkpointForm.metadata}
                    onChange={(e) => setCheckpointForm({ ...checkpointForm, metadata: e.target.value })}
                  />
                  <button
                    onClick={handleRecordCheckpoint}
                    className="w-full py-3 bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 rounded-xl font-bold hover:bg-yellow-500 hover:text-black transition-all"
                  >
                    Record Checkpoint
                  </button>
                </div>
              </div>

              {/* Complete Transit */}
              <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                  <CheckCircle className="w-5 h-5" /> Complete Transit
                </h3>
                <p className="text-gray-400 mb-4 text-sm">
                  Mark shipping as finished upon delivery confirmation.
                </p>
                <input
                  type="number"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white mb-4"
                  placeholder="Transit ID"
                  value={completeTransitId}
                  onChange={(e) => setCompleteTransitId(e.target.value)}
                />
                <button
                  onClick={handleCompleteTransit}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25 transition-all"
                >
                  Mark Delivered
                </button>
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
                    placeholder="Enter Transit ID"
                    className="w-full bg-space-blue-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-electric-blue outline-none"
                    value={searchTransitId}
                    onChange={(e) => setSearchTransitId(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => { fetchTransit(); fetchCheckpointCount(); }}
                  className="px-6 py-2.5 bg-electric-blue rounded-lg font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600"
                >
                  Track
                </button>
              </div>

              {transitData && (
                <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold font-heading">Transit #{searchTransitId}</h3>
                      <p className="text-sm text-gray-400">Batch ID: {transitData[0].toString()}</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${transitData[5] ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500" : "bg-green-500/10 border-green-500/50 text-green-500"}`}>
                      {transitData[5] ? "IN TRANSIT" : "DELIVERED / COMPLETED"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-500 uppercase text-xs">From</p>
                      <p className="font-mono text-xs break-all text-white">{transitData[1]}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-500 uppercase text-xs">To</p>
                      <p className="font-mono text-xs break-all text-white">{transitData[2]}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-500 uppercase text-xs">Start Time</p>
                      <p className="text-white">{new Date(Number(transitData[3]) * 1000).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-500 uppercase text-xs">Total Checkpoints</p>
                      <p className="text-white font-bold">{checkpointCount ? checkpointCount.toString() : "0"}</p>
                    </div>
                  </div>

                  {Number(transitData[4]) > 0 && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                      Ended at: {new Date(Number(transitData[4]) * 1000).toLocaleString()}
                    </div>
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
