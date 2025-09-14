const mqtt = require("mqtt");
const fs = require("fs");

// Connect to local MQTT broker (or EMQX, Mosquitto)
const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("IoT Listener connected");
  client.subscribe("medicine/data");
});

client.on("message", (topic, message) => {
  const data = JSON.parse(message.toString());
  console.log("Received:", data);

  // Save locally
  fs.appendFileSync("iot_readings.jsonl", JSON.stringify(data) + "\n");
});
