"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import AdminABI from "../../contracts/Admin.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [inputAddress, setInputAddress] = useState("");

  const { writeContractAsync } = useWriteContract();

  // ✅ Prevent hydration error
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // ------------------
  // Helper: call contract functions
  // ------------------
  const handleAction = async (fnName) => {
    if (!inputAddress) {
      alert("Enter an address first!");
      return;
    }
    try {
      await writeContractAsync({
        abi: AdminABI,
        address: CONTRACT_ADDRESSES.admin,
        functionName: fnName,
        args: [inputAddress],
      });
      alert(`✅ Transaction sent: ${fnName}(${inputAddress})`);
    } catch (err) {
      console.error(err);
      alert("❌ Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        ⚙️ Admin Dashboard
      </h1>

      <p className="mb-4 text-gray-700">
        Connected as: {isConnected ? address : "Not Connected"}
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg space-y-4 w-full max-w-lg">
        <input
          type="text"
          placeholder="Enter address"
          value={inputAddress}
          onChange={(e) => setInputAddress(e.target.value)}
          className="border p-2 rounded w-full"
        />

        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("approveManufacturer")}
            className="bg-green-600 text-white p-2 rounded"
          >
            Approve Manufacturer
          </button>
          <button
            onClick={() => handleAction("revokeManufacturer")}
            className="bg-red-600 text-white p-2 rounded"
          >
            Revoke Manufacturer
          </button>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("approveDistributor")}
            className="bg-green-600 text-white p-2 rounded"
          >
            Approve Distributor
          </button>
          <button
            onClick={() => handleAction("revokeDistributor")}
            className="bg-red-600 text-white p-2 rounded"
          >
            Revoke Distributor
          </button>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("approvePharmacy")}
            className="bg-green-600 text-white p-2 rounded"
          >
            Approve Pharmacy
          </button>
          <button
            onClick={() => handleAction("revokePharmacy")}
            className="bg-red-600 text-white p-2 rounded"
          >
            Revoke Pharmacy
          </button>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("approveDoctor")}
            className="bg-green-600 text-white p-2 rounded"
          >
            Approve Doctor
          </button>
          <button
            onClick={() => handleAction("revokeDoctor")}
            className="bg-red-600 text-white p-2 rounded"
          >
            Revoke Doctor
          </button>
        </div>

        {/* Row 5 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction("blacklistAddress")}
            className="bg-gray-800 text-white p-2 rounded"
          >
            Blacklist
          </button>
          <button
            onClick={() => handleAction("removeFromBlacklist")}
            className="bg-gray-500 text-white p-2 rounded"
          >
            Remove Blacklist
          </button>
        </div>
      </div>
    </div>
  );
}
