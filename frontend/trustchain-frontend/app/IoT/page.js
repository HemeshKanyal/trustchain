"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import IoTABI from "../../contracts-data/IoTTracker.json";
import { CONTRACT_ADDRESSES } from "../../contracts-data/addresses";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function IoTDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  const [batchId, setBatchId] = useState("");
  const [gpsLocation, setGpsLocation] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [rfidTag, setRfidTag] = useState("");

  const {
    data: logs,
    refetch: fetchLogs,
  } = useReadContract({
    abi: IoTABI,
    address: CONTRACT_ADDRESSES.iot,
    functionName: "getBatchLogs",
    args: batchId ? [Number(batchId)] : undefined,
  });

  const {
    data: envSummary,
    refetch: fetchSummary,
  } = useReadContract({
    abi: IoTABI,
    address: CONTRACT_ADDRESSES.iot,
    functionName: "getBatchEnvSummary",
    args: batchId ? [Number(batchId)] : undefined,
  });

  const handleLogData = async () => {
    await writeContract({
      abi: IoTABI,
      address: CONTRACT_ADDRESSES.iot,
      functionName: "logIoTData",
      args: [
        Number(batchId),
        gpsLocation,
        Number(temperature),
        Number(humidity),
        rfidTag,
      ],
    });
    alert("IoT Data Logged ✅");
    fetchLogs();
    fetchSummary();
  };

  // Prepare chart data
  const chartData = logs
    ? logs.map((log) => ({
      timestamp: new Date(Number(log.timestamp) * 1000).toLocaleTimeString(),
      temperature: Number(log.temperature),
      humidity: Number(log.humidity),
    }))
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">📡 IoT Dashboard</h1>
      <ConnectButton />

      {!isConnected ? (
        <p className="mt-4">Please connect your wallet</p>
      ) : (
        <div className="space-y-8 mt-6">
          {/* Log IoT Data */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">➕ Log IoT Data</h2>
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="GPS Location"
              value={gpsLocation}
              onChange={(e) => setGpsLocation(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Temperature (°C)"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="Humidity (%)"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
            />
            <input
              className="text-black p-2 w-full mb-2"
              placeholder="RFID Tag"
              value={rfidTag}
              onChange={(e) => setRfidTag(e.target.value)}
            />
            <button
              className="bg-blue-500 px-4 py-2 rounded"
              onClick={handleLogData}
            >
              Log Data
            </button>
          </div>

          {/* Fetch Logs & Charts */}
          <div className="bg-gray-800 p-4 rounded-xl">
            <h2 className="text-xl mb-2">📊 Batch Logs & Charts</h2>
            <button
              className="bg-green-500 px-4 py-2 rounded mb-4"
              onClick={() => {
                fetchLogs();
                fetchSummary();
              }}
            >
              Fetch Logs
            </button>

            {logs && logs.length > 0 ? (
              <>
                {/* Temperature Chart */}
                <div className="h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#444" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="temperature" stroke="#f87171" />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-center mt-2">🌡️ Temperature Trend</p>
                </div>

                {/* Humidity Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#444" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="humidity" stroke="#60a5fa" />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-center mt-2">💧 Humidity Trend</p>
                </div>
              </>
            ) : (
              <p>No logs found for this batch.</p>
            )}
          </div>

          {/* Env Summary */}
          {envSummary && (
            <div className="bg-gray-800 p-4 rounded-xl">
              <h2 className="text-xl mb-2">📋 Environmental Summary</h2>
              <p><b>Max Temp:</b> {envSummary[0].toString()}°C</p>
              <p><b>Min Temp:</b> {envSummary[1].toString()}°C</p>
              <p><b>Max Humidity:</b> {envSummary[2].toString()}%</p>
              <p><b>Min Humidity:</b> {envSummary[3].toString()}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
