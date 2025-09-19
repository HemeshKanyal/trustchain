"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import DoctorRegistryABI from "../../contracts/DoctorRegistry.json";
import PrescriptionABI from "../../contracts/Prescription.json";
import { CONTRACT_ADDRESSES } from "../../contracts/addresses";

export default function DoctorDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // form states
  const [doctorName, setDoctorName] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [patientAddr, setPatientAddr] = useState("");
  const [medicineListHash, setMedicineListHash] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

  // ✅ Apply as Doctor
  const handleApplyDoctor = async () => {
    await writeContract({
      abi: DoctorRegistryABI,
      address: CONTRACT_ADDRESSES.doctorRegistry,
      functionName: "applyAsDoctor",
      args: [doctorName, licenseId],
    });
    alert("Applied as Doctor 🩺");
  };

  // ✅ Update Doctor
  const handleUpdateDoctor = async () => {
    await writeContract({
      abi: DoctorRegistryABI,
      address: CONTRACT_ADDRESSES.doctorRegistry,
      functionName: "updateDoctorDetails",
      args: [doctorName, licenseId],
    });
    alert("Doctor Updated ✏️");
  };

  // ✅ Create Prescription
  const handleCreatePrescription = async () => {
    await writeContract({
      abi: PrescriptionABI,
      address: CONTRACT_ADDRESSES.prescription,
      functionName: "createPrescription",
      args: [patientAddr, medicineListHash],
    });
    alert("Prescription Created ✅");
  };

  // ✅ Cancel Prescription
  const handleCancelPrescription = async () => {
    await writeContract({
      abi: PrescriptionABI,
      address: CONTRACT_ADDRESSES.prescription,
      functionName: "cancelPrescription",
      args: [Number(prescriptionId)],
    });
    alert("Prescription Cancelled ❌");
  };

  // ✅ Fetch Doctor Info
  const { data: doctorInfo, refetch: fetchDoctor } = useReadContract({
    abi: DoctorRegistryABI,
    address: CONTRACT_ADDRESSES.doctorRegistry,
    functionName: "getDoctor",
    args: address ? [address] : undefined,
  });

  // ✅ Check Approval
  const { data: approved, refetch: fetchApproved } = useReadContract({
    abi: DoctorRegistryABI,
    address: CONTRACT_ADDRESSES.doctorRegistry,
    functionName: "isApprovedDoctor",
    args: address ? [address] : undefined,
  });

  // ✅ Get Prescription
  const { data: presData, refetch: fetchPrescription } = useReadContract({
    abi: PrescriptionABI,
    address: CONTRACT_ADDRESSES.prescription,
    functionName: "getPrescription",
    args: prescriptionId ? [Number(prescriptionId)] : undefined,
  });

  // ✅ Check Prescription Validity
  const { data: presValid, refetch: fetchValid } = useReadContract({
    abi: PrescriptionABI,
    address: CONTRACT_ADDRESSES.prescription,
    functionName: "isPrescriptionValid",
    args: prescriptionId ? [Number(prescriptionId)] : undefined,
  });

  // ✅ Get All Prescriptions of Patient
  const { data: patientPres, refetch: fetchPatientPres } = useReadContract({
    abi: PrescriptionABI,
    address: CONTRACT_ADDRESSES.prescription,
    functionName: "getPatientPrescriptions",
    args: patientAddr ? [patientAddr] : undefined,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">👨‍⚕️ Doctor Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Apply as Doctor */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">🩺 Apply as Doctor</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Doctor Name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="License ID"
              value={licenseId}
              onChange={(e) => setLicenseId(e.target.value)}
            />
            <button className="bg-blue-500 px-4 py-2 rounded" onClick={handleApplyDoctor}>
              Apply
            </button>
          </div>

          {/* Update Doctor */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">✏️ Update Doctor Details</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="New Name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="New License ID"
              value={licenseId}
              onChange={(e) => setLicenseId(e.target.value)}
            />
            <button className="bg-yellow-500 px-4 py-2 rounded" onClick={handleUpdateDoctor}>
              Update
            </button>
          </div>

          {/* Create Prescription */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📝 Create Prescription</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Patient Address"
              value={patientAddr}
              onChange={(e) => setPatientAddr(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Medicine List Hash (IPFS)"
              value={medicineListHash}
              onChange={(e) => setMedicineListHash(e.target.value)}
            />
            <button className="bg-green-500 px-4 py-2 rounded" onClick={handleCreatePrescription}>
              Create
            </button>
          </div>

          {/* Cancel Prescription */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">❌ Cancel Prescription</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Prescription ID"
              value={prescriptionId}
              onChange={(e) => setPrescriptionId(e.target.value)}
            />
            <button className="bg-red-500 px-4 py-2 rounded" onClick={handleCancelPrescription}>
              Cancel
            </button>
          </div>

          {/* View Doctor Info */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">👤 Doctor Info</h2>
            <button className="bg-purple-500 px-4 py-2 rounded" onClick={() => fetchDoctor()}>
              Fetch Info
            </button>
            {doctorInfo && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Name:</b> {doctorInfo.name}</p>
                <p><b>License:</b> {doctorInfo.licenseId}</p>
              </div>
            )}
          </div>

          {/* Approval Check */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">✅ Approval Status</h2>
            <button className="bg-indigo-500 px-4 py-2 rounded" onClick={() => fetchApproved()}>
              Check
            </button>
            {approved !== undefined && <p>{approved ? "Approved ✅" : "Not Approved ❌"}</p>}
          </div>

          {/* View Prescription */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📄 View Prescription</h2>
            <button className="bg-teal-500 px-4 py-2 rounded" onClick={() => fetchPrescription()}>
              Fetch Prescription
            </button>
            {presData && (
              <div className="mt-3 bg-gray-700 p-3 rounded">
                <p><b>Doctor:</b> {presData.doctor}</p>
                <p><b>Patient:</b> {presData.patient}</p>
                <p><b>Medicine Hash:</b> {presData.medicineListHash}</p>
                <p><b>Created:</b> {new Date(Number(presData.createdAt) * 1000).toLocaleDateString()}</p>
                <p><b>Cancelled:</b> {presData.cancelled ? "Yes" : "No"}</p>
              </div>
            )}
          </div>

          {/* Check Prescription Validity */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📌 Prescription Validity</h2>
            <button className="bg-orange-500 px-4 py-2 rounded" onClick={() => fetchValid()}>
              Check Validity
            </button>
            {presValid !== undefined && (
              <p>{presValid ? "Valid ✅" : "Invalid ❌"}</p>
            )}
          </div>

          {/* Patient Prescriptions */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">👨‍👩‍👦 Patient Prescriptions</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Patient Address"
              value={patientAddr}
              onChange={(e) => setPatientAddr(e.target.value)}
            />
            <button className="bg-pink-500 px-4 py-2 rounded" onClick={() => fetchPatientPres()}>
              Fetch Prescriptions
            </button>
            {patientPres && (
              <p>Prescription IDs: {patientPres.map((id) => id.toString()).join(", ")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
