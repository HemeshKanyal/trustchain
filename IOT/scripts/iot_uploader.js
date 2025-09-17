const axios = require("axios");
const fs = require("fs");

// Upload latest IoT reading to blockchain API
async function upload() {
  const lines = fs.readFileSync("iot_readings.jsonl", "utf-8").trim().split("\n");
  const latest = JSON.parse(lines[lines.length - 1]);

  try {
    await axios.post("http://localhost:5000/api/iot", latest); // backend → blockchain
    console.log("Uploaded to blockchain:", latest);
  } catch (err) {
    console.error("Upload failed:", err.message);
  }
}

upload();
