"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import PharmacyABI from "../../contracts/Pharmacy.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function PharmacyDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // form states
  const [batchId, setBatchId] = useState("");
  const [stripId, setStripId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");
  const [patientAddr, setPatientAddr] = useState("");

  // ✅ Receive Stock
  const handleReceiveStock = async () => {
    await writeContract({
      abi: PharmacyABI,
      address: CONTRACT_ADDRESSES.pharmacy,
      functionName: "receiveFromDistributor",
      args: [Number(batchId), Number(stripId), Number(quantity)],
    });
    alert("Stock Received ✅");
  };

  // ✅ Dispense With Prescription
  const handleDispenseWithPrescription = async () => {
    await writeContract({
      abi: PharmacyABI,
      address: CONTRACT_ADDRESSES.pharmacy,
      functionName: "dispenseStrip",
      args: [Number(prescriptionId), Number(stripId), Number(quantity)],
    });
    alert("Dispensed with Prescription ✅");
  };

  // ✅ Dispense Without Prescription
  const handleDispenseWithoutPrescription = async () => {
    await writeContract({
      abi: PharmacyABI,
      address: CONTRACT_ADDRESSES.pharmacy,
      functionName: "dispenseWithoutPrescription",
      args: [patientAddr, Number(stripId), Number(quantity)],
    });
    alert("Dispensed OTC ✅");
  };

  // ✅ Return Stock
  const handleReturnStock = async () => {
    await writeContract({
      abi: PharmacyABI,
      address: CONTRACT_ADDRESSES.pharmacy,
      functionName: "returnStock",
      args: [Number(stripId), Number(quantity)],
    });
    alert("Stock Returned ✅");
  };

  // ✅ Patient Return Medicine
  const handlePatientReturn = async () => {
    await writeContract({
      abi: PharmacyABI,
      address: CONTRACT_ADDRESSES.pharmacy,
      functionName: "returnMedicine",
      args: [Number(stripId), Number(quantity)],
    });
    alert("Medicine Returned by Patient ⚠️");
  };

  // ✅ View Stock
  const { data: stockData, refetch: fetchStock } = useReadContract({
    abi: PharmacyABI,
    address: CONTRACT_ADDRESSES.pharmacy,
    functionName: "getStock",
    args: address && stripId ? [address, Number(stripId)] : undefined,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🏪 Pharmacy Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Receive Stock */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📦 Receive Stock</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button className="bg-blue-500 px-4 py-2 rounded" onClick={handleReceiveStock}>Receive</button>
          </div>

          {/* Dispense With Prescription */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">💊 Dispense With Prescription</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Prescription ID" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button className="bg-green-500 px-4 py-2 rounded" onClick={handleDispenseWithPrescription}>Dispense</button>
          </div>

          {/* Dispense Without Prescription */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">🛒 Dispense Without Prescription (OTC)</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Patient Address" value={patientAddr} onChange={(e) => setPatientAddr(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button className="bg-yellow-500 px-4 py-2 rounded" onClick={handleDispenseWithoutPrescription}>Dispense OTC</button>
          </div>

          {/* Return Stock */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">↩️ Return Stock</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button className="bg-red-500 px-4 py-2 rounded" onClick={handleReturnStock}>Return</button>
          </div>

          {/* Patient Return Medicine */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">👤 Patient Return Medicine</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <input className="text-black p-2 w-full mb-2" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button className="bg-indigo-500 px-4 py-2 rounded" onClick={handlePatientReturn}>Return</button>
          </div>

          {/* View Stock */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📊 View Stock</h2>
            <input className="text-black p-2 w-full mb-2" placeholder="Strip ID" value={stripId} onChange={(e) => setStripId(e.target.value)} />
            <button className="bg-purple-500 px-4 py-2 rounded" onClick={() => fetchStock()}>Fetch Stock</button>
            {stockData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Batch ID:</b> {stockData.batchId?.toString()}</p>
                <p><b>Strip ID:</b> {stockData.stripId?.toString()}</p>
                <p><b>Available:</b> {stockData.availableQuantity?.toString()}</p>
                <p><b>Returned:</b> {stockData.returnedQuantity?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
