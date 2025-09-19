"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import PatientABI from "../../contracts/Patient.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function PatientDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  const [stripId, setStripId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

  // ✅ Register Patient
  const handleRegister = async () => {
    await writeContract({
      abi: PatientABI,
      address: CONTRACT_ADDRESSES.patient,
      functionName: "registerPatient",
      args: [],
    });
    alert("Patient Registered ✅");
  };

  // ✅ Deregister Patient
  const handleDeregister = async () => {
    await writeContract({
      abi: PatientABI,
      address: CONTRACT_ADDRESSES.patient,
      functionName: "deregisterPatient",
      args: [],
    });
    alert("Patient Deregistered ❌");
  };

  // ✅ Return Strip
  const handleReturnStrip = async () => {
    await writeContract({
      abi: PatientABI,
      address: CONTRACT_ADDRESSES.patient,
      functionName: "recordReturn",
      args: [address, Number(stripId), Number(quantity)],
    });
    alert("Strip Returned 🔄");
  };

  // ✅ Dispensed History
  const { data: dispensedHistory, refetch: fetchDispensed } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "getPatientStripHistory",
    args: stripId ? [address, Number(stripId)] : undefined,
  });

  // ✅ Returned History
  const { data: returnHistory, refetch: fetchReturn } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "getPatientReturnHistory",
    args: stripId ? [address, Number(stripId)] : undefined,
  });

  // ✅ Verify Strip
  const { data: verifyData, refetch: fetchVerify } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "verifyStrip",
    args:
      stripId && prescriptionId
        ? [address, Number(stripId), Number(prescriptionId)]
        : undefined,
  });

  // ✅ isPatientRegistered
  const { data: isRegistered, refetch: fetchIsRegistered } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "isPatientRegistered",
    args: address ? [address] : undefined,
  });

  // ✅ getPrescriptionLink
  const {
    data: prescriptionLinked,
    refetch: fetchPrescriptionLink,
  } = useReadContract({
    abi: PatientABI,
    address: CONTRACT_ADDRESSES.patient,
    functionName: "getPrescriptionLink",
    args:
      address && prescriptionId
        ? [address, Number(prescriptionId)]
        : undefined,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🧑‍⚕️ Patient Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Registration */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📝 Registration</h2>
            <button
              className="bg-blue-500 px-4 py-2 rounded mr-2"
              onClick={handleRegister}
            >
              Register
            </button>
            <button
              className="bg-red-500 px-4 py-2 rounded"
              onClick={handleDeregister}
            >
              Deregister
            </button>
          </div>

          {/* Return Strip */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">🔄 Return Strip</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Strip ID"
              value={stripId}
              onChange={(e) => setStripId(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <button
              className="bg-yellow-500 px-4 py-2 rounded"
              onClick={handleReturnStrip}
            >
              Return
            </button>
          </div>

          {/* View Histories */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📜 View History</h2>
            <button
              className="bg-purple-500 px-4 py-2 rounded mr-2"
              onClick={() => fetchDispensed()}
            >
              Fetch Dispensed
            </button>
            <button
              className="bg-indigo-500 px-4 py-2 rounded"
              onClick={() => fetchReturn()}
            >
              Fetch Returned
            </button>
            {dispensedHistory !== undefined && (
              <p>Dispensed: {dispensedHistory.toString()}</p>
            )}
            {returnHistory !== undefined && (
              <p>Returned: {returnHistory.toString()}</p>
            )}
          </div>

          {/* Verify Strip */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">✔️ Verify Strip</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Strip ID"
              value={stripId}
              onChange={(e) => setStripId(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Prescription ID (0 for OTC)"
              value={prescriptionId}
              onChange={(e) => setPrescriptionId(e.target.value)}
            />
            <button
              className="bg-green-500 px-4 py-2 rounded"
              onClick={() => fetchVerify()}
            >
              Verify
            </button>
            {verifyData && (
              <p>
                ✅ Result: {verifyData[0] ? "Valid" : "Invalid"} –{" "}
                {verifyData[1]}
              </p>
            )}
          </div>

          {/* isPatientRegistered */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">👤 Registration Status</h2>
            <button
              className="bg-teal-500 px-4 py-2 rounded"
              onClick={() => fetchIsRegistered()}
            >
              Check Status
            </button>
            {isRegistered !== undefined && (
              <p>Registered: {isRegistered ? "Yes ✅" : "No ❌"}</p>
            )}
          </div>

          {/* getPrescriptionLink */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📄 Prescription Link</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Prescription ID"
              value={prescriptionId}
              onChange={(e) => setPrescriptionId(e.target.value)}
            />
            <button
              className="bg-orange-500 px-4 py-2 rounded"
              onClick={() => fetchPrescriptionLink()}
            >
              Check Link
            </button>
            {prescriptionLinked !== undefined && (
              <p>
                Linked: {prescriptionLinked ? "Yes ✅" : "No ❌"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
