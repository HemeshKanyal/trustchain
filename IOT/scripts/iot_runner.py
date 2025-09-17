import argparse
import json
import random
import time
import hashlib
import serial
import sys
import os

# ---------------- CONFIG ----------------
DEFAULT_CONFIG = {
    "batch_id": "BATCH001",
    "temp_range": [2, 25],      # safe storage temp (°C)
    "humidity_range": [30, 70], # safe humidity (%)
    "gps_route": [
        {"lat": 28.61, "lon": 77.21}, # Delhi
        {"lat": 25.45, "lon": 81.84}, # Prayagraj
        {"lat": 23.26, "lon": 77.41}, # Bhopal
        {"lat": 19.07, "lon": 72.87}  # Mumbai
    ],
    "rfid_whitelist": ["MED123456", "MED987654", "MED543210"]
}

# ---------------- Helper ----------------
def calc_hash(data):
    return hashlib.sha256(json.dumps(data).encode()).hexdigest()

def validate(data, cfg):
    flags = []
    if "temperature" in data and not (cfg["temp_range"][0] <= data["temperature"] <= cfg["temp_range"][1]):
        flags.append("TEMP_OUT_OF_RANGE")
    if "humidity" in data and not (cfg["humidity_range"][0] <= data["humidity"] <= cfg["humidity_range"][1]):
        flags.append("HUMIDITY_OUT_OF_RANGE")
    if "rfid_tag" in data and data["rfid_tag"] not in cfg["rfid_whitelist"]:
        flags.append("INVALID_RFID")
    return flags

# ---------------- Emulator ----------------
def run_emulator(cfg):
    print("🚀 IoT Emulator Started. Logging to: logs/iot_logs.jsonl")
    os.makedirs("logs", exist_ok=True)
    with open("logs/iot_logs.jsonl", "a") as f:
        while True:
            sensor = {
                "batch_id": cfg["batch_id"],
                "timestamp": time.time(),
                "rfid_tag": random.choice(cfg["rfid_whitelist"]),
                "temperature": round(random.uniform(15, 30), 2),
                "humidity": round(random.uniform(40, 80), 2),
                "gps": random.choice(cfg["gps_route"])
            }
            sensor["hash"] = calc_hash(sensor)
            flags = validate(sensor, cfg)
            sensor["flags"] = flags

            print("📡 Emulator Data:", json.dumps(sensor, indent=2))
            f.write(json.dumps(sensor) + "\n")
            f.flush()
            time.sleep(3)

# ---------------- Hardware ----------------
def run_hardware(cfg, port):
    try:
        ser = serial.Serial(port, 9600, timeout=1)
        print(f"✅ Connected to hardware on {port}")
    except Exception as e:
        print(f"❌ Could not open {port}: {e}")
        sys.exit(1)

    os.makedirs("logs", exist_ok=True)
    with open("logs/iot_hardware_logs.jsonl", "a") as f:
        while True:
            try:
                line = ser.readline().decode("utf-8").strip()
                if not line:
                    continue
                if line.startswith("{") and line.endswith("}"):
                    data = json.loads(line)
                    data["batch_id"] = cfg["batch_id"]
                    data["timestamp"] = time.time()
                    data["hash"] = calc_hash(data)
                    data["flags"] = validate(data, cfg)

                    print("📡 Hardware Data:", json.dumps(data, indent=2))
                    f.write(json.dumps(data) + "\n")
                    f.flush()

                    # 🔗 TODO: send to backend / blockchain
                else:
                    print("🔎 Raw:", line)

            except KeyboardInterrupt:
                print("\n🛑 Stopped by user")
                break
            except Exception as e:
                print("⚠️ Error:", e)
                time.sleep(1)
    ser.close()

# ---------------- Main ----------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["emulator", "hardware"], required=True, help="Run mode")
    parser.add_argument("--port", help="Serial port for hardware (e.g., COM3, /dev/ttyUSB0)")
    args = parser.parse_args()

    cfg = DEFAULT_CONFIG

    if args.mode == "emulator":
        run_emulator(cfg)
    elif args.mode == "hardware":
        if not args.port:
            print("❌ You must provide --port for hardware mode")
            sys.exit(1)
        run_hardware(cfg, args.port)
