"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  Plus,
  Layers,
  AlertTriangle,
  FileText,
  Search,
  Package,
  Calendar,
  Hash,
  Activity,
  Box
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import ManufacturerABI from "../../contracts-data/Manufacturer.json";
import { CONTRACT_ADDRESSES } from "../../contracts-data/addresses";

export default function ManufacturerDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("CREATE_BATCH");

  // Form States
  const [batchForm, setBatchForm] = useState({ name: "", quantity: "", expiry: "", hash: "" });
  const [stripForm, setStripForm] = useState({ batchId: "", hash: "", composition: "", expiry: "" });
  const [actionBatchId, setActionBatchId] = useState("");
  const [updateForm, setUpdateForm] = useState({ name: "", expiry: "" });

  // Search States
  const [searchId, setSearchId] = useState("");
  const [searchType, setSearchType] = useState("BATCH"); // BATCH | STRIP

  useEffect(() => setMounted(true), []);

  // Contract Reads
  const { data: batchData, refetch: fetchBatch, isError: isBatchError } = useReadContract({
    abi: ManufacturerABI,
    address: CONTRACT_ADDRESSES.manufacturer,
    functionName: "getBatch",
    args: searchType === "BATCH" && searchId ? [Number(searchId)] : undefined,
    query: { enabled: false }
  });

  const { data: stripData, refetch: fetchStrip, isError: isStripError } = useReadContract({
    abi: ManufacturerABI,
    address: CONTRACT_ADDRESSES.manufacturer,
    functionName: "getStrip",
    args: searchType === "STRIP" && searchId ? [Number(searchId)] : undefined,
    query: { enabled: false }
  });

  const handleSearch = () => {
    if (!searchId) return;
    if (searchType === "BATCH") fetchBatch();
    else fetchStrip();
  };

  // Write Actions
  const handleCreateBatch = async () => {
    try {
      await writeContractAsync({
        abi: ManufacturerABI,
        address: CONTRACT_ADDRESSES.manufacturer,
        functionName: "createBatch",
        args: [
          batchForm.name,
          Number(batchForm.quantity),
          Math.floor(new Date(batchForm.expiry).getTime() / 1000),
          batchForm.hash,
        ],
      });
      alert("✅ Batch Creation Transaction Sent");
      setBatchForm({ name: "", quantity: "", expiry: "", hash: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleAddStrip = async () => {
    try {
      await writeContractAsync({
        abi: ManufacturerABI,
        address: CONTRACT_ADDRESSES.manufacturer,
        functionName: "addStrip",
        args: [
          Number(stripForm.batchId),
          stripForm.hash,
          stripForm.composition,
          Math.floor(new Date(stripForm.expiry).getTime() / 1000),
        ],
      });
      alert("✅ Strip Addition Transaction Sent");
      setStripForm({ batchId: "", hash: "", composition: "", expiry: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleRecall = async () => {
    try {
      await writeContractAsync({
        abi: ManufacturerABI,
        address: CONTRACT_ADDRESSES.manufacturer,
        functionName: "recallBatch",
        args: [Number(actionBatchId)],
      });
      alert("⚠️ Recall Transaction Sent");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleUpdate = async () => {
    try {
      await writeContractAsync({
        abi: ManufacturerABI,
        address: CONTRACT_ADDRESSES.manufacturer,
        functionName: "updateBatch",
        args: [
          Number(actionBatchId),
          updateForm.name,
          Math.floor(new Date(updateForm.expiry).getTime() / 1000),
        ],
      });
      alert("✏️ Update Transaction Sent");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (!mounted) return null;

  return (
    <DashboardLayout role="Manufacturer">
      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <Activity className="w-16 h-16 mb-4 opacity-20" />
          <p>Please connect your designated manufacturer wallet</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* 🔹 Navigation Tabs */}
          <div className="flex overflow-x-auto gap-4 border-b border-white/5 pb-4">
            {[
              { id: "CREATE_BATCH", label: "Create Batch", icon: Plus },
              { id: "ADD_STRIP", label: "Add Strip", icon: Layers },
              { id: "MANAGE", label: "Manage / Recall", icon: AlertTriangle },
              { id: "EXPLORER", label: "Explorer", icon: Search },
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

          {/* 🔹 CREATE BATCH TAB */}
          {activeTab === "CREATE_BATCH" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Package className="text-electric-blue" />
                Create New Batch
              </h2>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Batch Name</label>
                    <input
                      type="text"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none transition-colors"
                      placeholder="e.g. Paracetamol-X"
                      value={batchForm.name}
                      onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-electric-blue outline-none transition-colors"
                      placeholder="1000"
                      value={batchForm.quantity}
                      onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Expiry Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        type="date"
                        className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-electric-blue outline-none transition-colors"
                        value={batchForm.expiry}
                        onChange={(e) => setBatchForm({ ...batchForm, expiry: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Batch Hash / ID</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        type="text"
                        className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-electric-blue outline-none transition-colors"
                        placeholder="Unique Identifier"
                        value={batchForm.hash}
                        onChange={(e) => setBatchForm({ ...batchForm, hash: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateBatch}
                  className="w-full py-4 mt-4 bg-gradient-to-r from-electric-blue to-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
                >
                  Create Batch on Chain
                </button>
              </div>
            </div>
          )}

          {/* 🔹 ADD STRIP TAB */}
          {activeTab === "ADD_STRIP" && (
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Layers className="text-vivid-purple" />
                Add Strip to Batch
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Parent Batch ID</label>
                  <input
                    type="number"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none transition-colors"
                    placeholder="Enter Batch ID"
                    value={stripForm.batchId}
                    onChange={(e) => setStripForm({ ...stripForm, batchId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Composition</label>
                  <input
                    type="text"
                    className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none transition-colors"
                    placeholder="Chemical composition..."
                    value={stripForm.composition}
                    onChange={(e) => setStripForm({ ...stripForm, composition: e.target.value })}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Strip Expiry</label>
                    <input
                      type="date"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none transition-colors"
                      value={stripForm.expiry}
                      onChange={(e) => setStripForm({ ...stripForm, expiry: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Strip Hash</label>
                    <input
                      type="text"
                      className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white focus:border-vivid-purple outline-none transition-colors"
                      placeholder="Unique Strip Hash"
                      value={stripForm.hash}
                      onChange={(e) => setStripForm({ ...stripForm, hash: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddStrip}
                  className="w-full py-4 mt-4 bg-gradient-to-r from-vivid-purple to-purple-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all active:scale-[0.98]"
                >
                  Add Strip
                </button>
              </div>
            </div>
          )}

          {/* 🔹 MANAGE TAB (Recall / Update) */}
          {activeTab === "MANAGE" && (
            <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Recall Section */}
              <div className="glass p-6 rounded-3xl border border-red-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-16 bg-red-500/5 rounded-full blur-2xl" />
                <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Recall Batch
                </h3>
                <p className="text-sm text-gray-500 mb-4">Emergency update to flag a batch as unsafe.</p>

                <input
                  type="number"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white mb-4 focus:border-red-500 outline-none"
                  placeholder="Batch ID to Recall"
                  value={actionBatchId}
                  onChange={(e) => setActionBatchId(e.target.value)}
                />
                <button
                  onClick={handleRecall}
                  className="w-full py-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all"
                >
                  Execute Recall
                </button>
              </div>

              {/* Update Section */}
              <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Update Details
                </h3>
                <input
                  type="number"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white mb-3"
                  placeholder="Batch ID"
                  value={actionBatchId}
                  onChange={(e) => setActionBatchId(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white mb-3"
                  placeholder="New Name"
                  value={updateForm.name}
                  onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })}
                />
                <input
                  type="date"
                  className="w-full bg-space-blue-800 border border-gray-700 rounded-lg p-3 text-white mb-4"
                  value={updateForm.expiry}
                  onChange={(e) => setUpdateForm({ ...updateForm, expiry: e.target.value })}
                />
                <button
                  onClick={handleUpdate}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Update Batch Info
                </button>
              </div>
            </div>
          )}

          {/* 🔹 EXPLORER TAB */}
          {activeTab === "EXPLORER" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                <div className="flex bg-space-blue-800 rounded-lg p-1">
                  <button
                    onClick={() => setSearchType("BATCH")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${searchType === "BATCH" ? "bg-electric-blue text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Batch
                  </button>
                  <button
                    onClick={() => setSearchType("STRIP")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${searchType === "STRIP" ? "bg-electric-blue text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Strip
                  </button>
                </div>
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="number"
                    placeholder={`Enter ${searchType === "BATCH" ? "Batch" : "Strip"} ID`}
                    className="w-full bg-space-blue-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-electric-blue outline-none"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-2.5 bg-electric-blue rounded-lg font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-my-blue-600"
                >
                  Fetch
                </button>
              </div>

              {/* Results Area */}
              <div className="min-h-[200px]">
                {searchType === "BATCH" && batchData && (
                  <div className="glass p-6 rounded-2xl border border-white/10">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold font-heading">{batchData.name}</h3>
                        <p className="text-gray-400 text-sm">Batch ID: #{searchId}</p>
                      </div>
                      {batchData.recalled && (
                        <span className="px-3 py-1 bg-red-500/20 text-red-500 border border-red-500/50 rounded-full text-xs font-bold uppercase tracking-wider">
                          Recalled
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500 uppercase">Quantity</p>
                        <p className="text-lg font-mono">{batchData.quantity.toString()}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500 uppercase">Expiry</p>
                        <p className="text-lg font-mono">{new Date(Number(batchData.expiryDate) * 1000).toLocaleDateString()}</p>
                      </div>
                      <div className="col-span-2 p-4 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500 uppercase">Manufacturer</p>
                        <p className="text-sm font-mono text-electric-blue break-all">{batchData.manufacturer}</p>
                      </div>
                    </div>
                  </div>
                )}

                {searchType === "STRIP" && stripData && (
                  <div className="glass p-6 rounded-2xl border border-white/10">
                    <h3 className="text-2xl font-bold font-heading mb-6">Strip #{searchId}</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between">
                        <span className="text-gray-400">Composition</span>
                        <span className="font-medium">{stripData.composition}</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between">
                        <span className="text-gray-400">Batch ID</span>
                        <span className="font-medium">#{stripData.batchId.toString()}</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between">
                        <span className="text-gray-400">Expiry</span>
                        <span className="font-medium">{new Date(Number(stripData.expiryDate) * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-gray-400 block mb-1">Hash</span>
                        <span className="font-mono text-xs text-gray-300 break-all">{stripData.stripHash}</span>
                      </div>
                    </div>
                  </div>
                )}

                {!batchData && !stripData && !isBatchError && !isStripError && (
                  <div className="text-center text-gray-500 mt-10">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>Search for a batch or strip to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </DashboardLayout>
  );
}
