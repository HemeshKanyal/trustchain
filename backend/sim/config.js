// Simulator settings. Presets trade realism for visible activity; every action is still a real transaction.
import "dotenv/config";

const PRESETS = {
  // Local chain demo: lots happens in a few minutes.
  showcase: { boxes: 16, tripMinutes: [1.5, 8], sampleSeconds: 10, windowSeconds: 60, salesPerPharmacyPerHour: 40, rxShare: 0.35, patientScanChance: 0.25, counterfeitScansPerHour: 6, reefersFailChance: 0.03, lidOpenChance: 0.02, sensorDropChance: 0.03, reviewMinutes: [2, 4], tick: 2 },
  // Sepolia: gentle, real-time pace to save test ETH.
  live: { boxes: 6, tripMinutes: [45, 120], sampleSeconds: 30, windowSeconds: 600, salesPerPharmacyPerHour: 2, rxShare: 0.35, patientScanChance: 0.15, counterfeitScansPerHour: 0.3, reefersFailChance: 0.04, lidOpenChance: 0.02, sensorDropChance: 0.03, reviewMinutes: [60, 240], tick: 10 },
};

const preset = process.env.SIM_PRESET ?? "showcase";
export const sim = {
  preset,
  ...(PRESETS[preset] ?? PRESETS.showcase),
  controlPort: Number(process.env.SIM_PORT ?? 4100),
  apiUrl: process.env.SIM_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  // Sepolia: a wallet you top up from a faucet; it funds the simulated organisations' gas.
  funderKey: process.env.SIM_FUNDER_KEY || null,
  minBalanceEth: Number(process.env.SIM_MIN_BALANCE ?? 0.02),
  topUpEth: Number(process.env.SIM_TOP_UP ?? 0.05),
  // Real smart boxes (e.g. the ESP32) that the simulated distributors may load onto trucks.
  realBoxes: (process.env.SIM_REAL_BOXES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
