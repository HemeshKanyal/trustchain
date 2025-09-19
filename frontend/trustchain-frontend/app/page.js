"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import AdminABI from "../contracts/Admin.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [checkAddress, setCheckAddress] = useState("");

  // ✅ Fix hydration issue
  useEffect(() => setMounted(true), []);

  // ✅ Always call hook (safe default arg prevents crash)
  const { data: isApproved, isLoading, error } = useReadContract({
    abi: AdminABI,
    address: CONTRACT_ADDRESSES.admin,
    functionName: "approvedManufacturers",
    args: [
      checkAddress && checkAddress.length === 42
        ? checkAddress
        : "0x0000000000000000000000000000000000000000",
    ],
  });

  if (!mounted) {
    // ✅ Prevent white page → show fallback
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-xl animate-pulse">Loading TrustChain...</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white space-y-6">
      <h1 className="text-3xl font-bold">🚀 TrustChain</h1>
      <ConnectButton />

      {isConnected && (
        <div className="bg-gray-800 p-4 rounded-xl space-y-3 w-96">
          <p>Your wallet: {address}</p>
          <input
            type="text"
            placeholder="Enter manufacturer address"
            className="w-full px-2 py-1 text-black rounded"
            value={checkAddress}
            onChange={(e) => setCheckAddress(e.target.value)}
          />

          <button
            className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded w-full"
            disabled={!checkAddress || checkAddress.length !== 42}
          >
            {isLoading ? "Checking..." : "Check Manufacturer Approval"}
          </button>

          {error && <p className="text-red-400">⚠️ Error: {error.message}</p>}
          {checkAddress && checkAddress.length === 42 && isApproved !== undefined && (
            <p className="mt-2">
              ✅ Approved? {isApproved ? "Yes" : "No"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
