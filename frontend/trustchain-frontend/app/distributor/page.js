"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import DistributorABI from "../../contracts/Distributor.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function DistributorDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // Form states
  const [batchId, setBatchId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [transitId, setTransitId] = useState("");
  const [location, setLocation] = useState("");
  const [metadata, setMetadata] = useState("");
  const [checkpointId, setCheckpointId] = useState("");

  // ✅ Receive batch
  const handleReceive = async () => {
    await writeContract({
      abi: DistributorABI,
      address: CONTRACT_ADDRESSES.distributor,
      functionName: "receiveFromManufacturer",
      args: [Number(batchId)],
    });
    alert("✅ Received batch from manufacturer");
  };

  // ✅ Start transit
  const handleStartTransit = async () => {
    await writeContract({
      abi: DistributorABI,
      address: CONTRACT_ADDRESSES.distributor,
      functionName: "startTransit",
      args: [Number(batchId), recipient],
    });
    alert("🚚 Transit started");
  };

  // ✅ Record checkpoint
  const handleCheckpoint = async () => {
    await writeContract({
      abi: DistributorABI,
      address: CONTRACT_ADDRESSES.distributor,
      functionName: "recordCheckpoint",
      args: [Number(transitId), location, metadata],
    });
    alert("📍 Checkpoint recorded");
  };

  // ✅ Complete transit
  const handleCompleteTransit = async () => {
    await writeContract({
      abi: DistributorABI,
      address: CONTRACT_ADDRESSES.distributor,
      functionName: "completeTransit",
      args: [Number(transitId)],
    });
    alert("✅ Transit completed");
  };

  // ✅ View Transit
  const { data: transitData, refetch: fetchTransit } = useReadContract({
    abi: DistributorABI,
    address: CONTRACT_ADDRESSES.distributor,
    functionName: "getTransit",
    args: transitId ? [Number(transitId)] : undefined,
  });

  // ✅ View Checkpoint (single)
  const { data: checkpointData, refetch: fetchCheckpoint } = useReadContract({
    abi: DistributorABI,
    address: CONTRACT_ADDRESSES.distributor,
    functionName: "getCheckpoint",
    args: checkpointId && transitId ? [Number(transitId), Number(checkpointId)] : undefined,
  });

  // ✅ Get checkpoint count
  const { data: checkpointCount, refetch: fetchCheckpointCount } = useReadContract({
    abi: DistributorABI,
    address: CONTRACT_ADDRESSES.distributor,
    functionName: "getCheckpointCount",
    args: transitId ? [Number(transitId)] : undefined,
  });

  const [checkpointList, setCheckpointList] = useState([]);

  // Fetch all checkpoints
  const handleFetchAllCheckpoints = async () => {
    if (!checkpointCount || checkpointCount === 0) {
      alert("No checkpoints found");
      return;
    }

    const promises = [];
    for (let i = 0; i < Number(checkpointCount); i++) {
      promises.push(
        useReadContract({
          abi: DistributorABI,
          address: CONTRACT_ADDRESSES.distributor,
          functionName: "getCheckpoint",
          args: [Number(transitId), i],
        }).data
      );
    }

    // ❗ since wagmi hooks can't be called dynamically inside loops,
    // you’d usually move this into a backend or viem client call
    // but for now we can just show checkpointCount and let user query individually
    alert("⚠️ For listing, better to fetch individually (wagmi limitation)");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🚚 Distributor Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Receive */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📦 Receive Batch</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
            <button className="bg-blue-500 px-4 py-2 rounded" onClick={handleReceive}>Receive</button>
          </div>

          {/* Start Transit */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">🚛 Start Transit</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Recipient Address" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            <button className="bg-green-500 px-4 py-2 rounded" onClick={handleStartTransit}>Start Transit</button>
          </div>

          {/* Record Checkpoint */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📍 Record Checkpoint</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Transit ID" value={transitId} onChange={(e) => setTransitId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Metadata" value={metadata} onChange={(e) => setMetadata(e.target.value)} />
            <button className="bg-yellow-500 px-4 py-2 rounded" onClick={handleCheckpoint}>Record</button>
          </div>

          {/* Complete Transit */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">✅ Complete Transit</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Transit ID" value={transitId} onChange={(e) => setTransitId(e.target.value)} />
            <button className="bg-red-500 px-4 py-2 rounded" onClick={handleCompleteTransit}>Complete</button>
          </div>

          {/* View Transit */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">🔎 View Transit</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Transit ID" value={transitId} onChange={(e) => setTransitId(e.target.value)} />
            <button className="bg-purple-500 px-4 py-2 rounded" onClick={() => fetchTransit()}>Fetch Transit</button>
            {transitData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Batch ID:</b> {transitData[0].toString()}</p>
                <p><b>From:</b> {transitData[1]}</p>
                <p><b>To:</b> {transitData[2]}</p>
                <p><b>Start:</b> {new Date(Number(transitData[3]) * 1000).toLocaleString()}</p>
                <p><b>End:</b> {transitData[4] == 0 ? "Ongoing" : new Date(Number(transitData[4]) * 1000).toLocaleString()}</p>
                <p><b>In Transit:</b> {transitData[5] ? "Yes" : "No"}</p>
              </div>
            )}
          </div>

          {/* View Checkpoint (Single) */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📍 View Checkpoint</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Transit ID" value={transitId} onChange={(e) => setTransitId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Checkpoint ID" value={checkpointId} onChange={(e) => setCheckpointId(e.target.value)} />
            <button className="bg-indigo-500 px-4 py-2 rounded" onClick={() => fetchCheckpoint()}>Fetch Checkpoint</button>
            {checkpointData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Time:</b> {new Date(Number(checkpointData[0]) * 1000).toLocaleString()}</p>
                <p><b>Location:</b> {checkpointData[1]}</p>
                <p><b>Metadata:</b> {checkpointData[2]}</p>
              </div>
            )}
          </div>

          {/* View All Checkpoints */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📍📍 View All Checkpoints</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Transit ID" value={transitId} onChange={(e) => setTransitId(e.target.value)} />
            <button className="bg-teal-500 px-4 py-2 rounded" onClick={() => fetchCheckpointCount()}>Get Count</button>
            {checkpointCount && <p>Total Checkpoints: {checkpointCount.toString()}</p>}
            <p className="text-gray-400 text-sm mt-2">⚠️ To fetch all, query each checkpoint ID manually or use a viem client loop.</p>
          </div>
        </div>
      )}
    </div>
  );
}
