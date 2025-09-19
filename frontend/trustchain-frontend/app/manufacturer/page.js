"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ManufacturerABI from "../../contracts/Manufacturer.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function ManufacturerDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // form states
  const [batchName, setBatchName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchHash, setBatchHash] = useState("");

  const [batchId, setBatchId] = useState("");
  const [stripId, setStripId] = useState("");
  const [stripHash, setStripHash] = useState("");
  const [composition, setComposition] = useState("");
  const [stripExpiry, setStripExpiry] = useState("");

  // ✅ Create Batch
  const handleCreateBatch = async () => {
    await writeContract({
      abi: ManufacturerABI,
      address: CONTRACT_ADDRESSES.manufacturer,
      functionName: "createBatch",
      args: [
        batchName,
        Number(quantity),
        Math.floor(new Date(expiryDate).getTime() / 1000),
        batchHash,
      ],
    });
    alert("Batch Created ✅");
  };

  // ✅ Add Strip
  const handleAddStrip = async () => {
    await writeContract({
      abi: ManufacturerABI,
      address: CONTRACT_ADDRESSES.manufacturer,
      functionName: "addStrip",
      args: [
        Number(batchId),
        stripHash,
        composition,
        Math.floor(new Date(stripExpiry).getTime() / 1000),
      ],
    });
    alert("Strip Added ✅");
  };

  // ✅ Recall Batch
  const handleRecallBatch = async () => {
    await writeContract({
      abi: ManufacturerABI,
      address: CONTRACT_ADDRESSES.manufacturer,
      functionName: "recallBatch",
      args: [Number(batchId)],
    });
    alert("Batch Recalled ⚠️");
  };

  // ✅ Update Batch
  const handleUpdateBatch = async () => {
    await writeContract({
      abi: ManufacturerABI,
      address: CONTRACT_ADDRESSES.manufacturer,
      functionName: "updateBatch",
      args: [
        Number(batchId),
        batchName,
        Math.floor(new Date(expiryDate).getTime() / 1000),
      ],
    });
    alert("Batch Updated ✏️");
  };

  // ✅ View Batch
  const {
    data: batchData,
    refetch: fetchBatch,
  } = useReadContract({
    abi: ManufacturerABI,
    address: CONTRACT_ADDRESSES.manufacturer,
    functionName: "getBatch",
    args: batchId ? [Number(batchId)] : undefined,
  });

  // ✅ View Strip
  const {
    data: stripData,
    refetch: fetchStrip,
  } = useReadContract({
    abi: ManufacturerABI,
    address: CONTRACT_ADDRESSES.manufacturer,
    functionName: "getStrip",
    args: stripId ? [Number(stripId)] : undefined,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🏭 Manufacturer Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Create Batch */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">➕ Create Batch</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch Name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              type="number"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch Hash"
              value={batchHash}
              onChange={(e) => setBatchHash(e.target.value)}
            />
            <button
              className="bg-blue-500 px-4 py-2 rounded"
              onClick={handleCreateBatch}
            >
              Create
            </button>
          </div>

          {/* Add Strip */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">➕ Add Strip</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Strip Hash"
              value={stripHash}
              onChange={(e) => setStripHash(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Composition"
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              type="date"
              value={stripExpiry}
              onChange={(e) => setStripExpiry(e.target.value)}
            />
            <button
              className="bg-green-500 px-4 py-2 rounded"
              onClick={handleAddStrip}
            >
              Add Strip
            </button>
          </div>

          {/* Recall Batch */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">⚠️ Recall Batch</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <button
              className="bg-red-500 px-4 py-2 rounded"
              onClick={handleRecallBatch}
            >
              Recall
            </button>
          </div>

          {/* Update Batch */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">✏️ Update Batch</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="New Name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <button
              className="bg-yellow-500 px-4 py-2 rounded"
              onClick={handleUpdateBatch}
            >
              Update
            </button>
          </div>

          {/* View Batch */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📦 View Batch</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <button
              className="bg-purple-500 px-4 py-2 rounded"
              onClick={() => fetchBatch()}
            >
              Fetch Batch
            </button>
            {batchData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Name:</b> {batchData.name}</p>
                <p><b>Quantity:</b> {batchData.quantity.toString()}</p>
                <p><b>Manufacturer:</b> {batchData.manufacturer}</p>
                <p><b>Expiry:</b> {new Date(Number(batchData.expiryDate) * 1000).toLocaleDateString()}</p>
                <p><b>Recalled:</b> {batchData.recalled ? "Yes" : "No"}</p>
              </div>
            )}
          </div>

          {/* View Strip */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">💊 View Strip</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Strip ID"
              value={stripId}
              onChange={(e) => setStripId(e.target.value)}
            />
            <button
              className="bg-indigo-500 px-4 py-2 rounded"
              onClick={() => fetchStrip()}
            >
              Fetch Strip
            </button>
            {stripData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Strip Hash:</b> {stripData.stripHash}</p>
                <p><b>Composition:</b> {stripData.composition}</p>
                <p><b>Expiry:</b> {new Date(Number(stripData.expiryDate) * 1000).toLocaleDateString()}</p>
                <p><b>Batch ID:</b> {stripData.batchId.toString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
