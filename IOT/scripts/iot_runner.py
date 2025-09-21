import argparse
import json
import os
import sys
import time
import datetime
import serial
import paho.mqtt.client as mqtt

# ---------------------------
# Globals
# ---------------------------
last_rfid = None
last_gps = None

# ---------------------------
# Logging setup
# ---------------------------
def get_log_file():
    """Return today's log file path inside logs/ directory."""
    today = datetime.date.today().isoformat()
    os.makedirs("logs", exist_ok=True)
    return os.path.join("logs", f"{today}.log")

def append_log(entry: dict):
    """Append a JSON entry to the daily log file."""
    with open(get_log_file(), "a") as f:
        f.write(json.dumps(entry) + "\n")

# ---------------------------
# Fault Detection
# ---------------------------
def detect_faults(data: dict) -> dict:
    faults = {}
    try:
        temp = data.get("temperature")
        hum = data.get("humidity")

        faults["temperature_high"] = temp is not None and temp > 50
        faults["temperature_low"] = temp is not None and temp < -10
        faults["humidity_high"] = hum is not None and hum > 90
        faults["humidity_low"] = hum is not None and hum < 10

    except Exception as e:
        print(f"⚠️ Fault detection error: {e}")
    return faults

# ---------------------------
# Data Cleaning
# ---------------------------
def clean_and_log(data: dict):
    global last_rfid, last_gps

    # Use last valid RFID if current is missing
    if data.get("rfid_tag"):
        last_rfid = data["rfid_tag"]
    else:
        data["rfid_tag"] = last_rfid

    # Use last valid GPS if current is missing or invalid
    gps = data.get("gps")
    if gps and gps.get("lat") != 0.0 and gps.get("lon") != 0.0:
        last_gps = gps
    else:
        data["gps"] = last_gps

    # Add timestamp
    data["logged_at"] = datetime.datetime.utcnow().isoformat()

    # Run fault detection
    data["faults"] = detect_faults(data)

    # Print and log
    print(f"📥 Data: {data}")
    append_log(data)

# ---------------------------
# Hardware Mode
# ---------------------------
def run_hardware(config, port, baud):
    try:
        ser = serial.Serial(port, baud, timeout=1)
        print(f"✅ Connected to IoT hardware on {port} at {baud} baud")
    except Exception as e:
        print(f"❌ Could not open serial port: {e}")
        return

    buffer = ""
    try:
        while True:
            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                continue

            # Try parse JSON directly
            if line.startswith("{") and line.endswith("}"):
                try:
                    data = json.loads(line)
                    clean_and_log(data)
                except Exception as e:
                    print(f"⚠️ Failed to parse JSON: {e} | line: {line}")
                continue

            # Otherwise, try extract JSON chunks
            buffer += line
            if "{" in buffer and "}" in buffer:
                start = buffer.find("{")
                end = buffer.find("}", start)
                if end != -1:
                    chunk = buffer[start:end+1]
                    buffer = buffer[end+1:]
                    try:
                        data = json.loads(chunk)
                        clean_and_log(data)
                    except Exception as e:
                        print(f"⚠️ Failed to parse JSON chunk: {e} | chunk: {chunk}")
            else:
                print(f"🔎 NMEA: {line}")

    except KeyboardInterrupt:
        print("\n⏹️ IoT runner stopped manually")
    finally:
        ser.close()

# ---------------------------
# Simulated Mode
# ---------------------------
def run_simulated(config):
    import random
    global last_rfid, last_gps
    last_rfid = None
    last_gps = None

    try:
        while True:
            data = {
                "rfid_tag": random.choice([None, "SIM123", "SIM456"]),
                "temperature": round(random.uniform(15, 40), 2),
                "humidity": round(random.uniform(20, 80), 2),
                "gps": {
                    "lat": round(random.uniform(-90, 90), 6),
                    "lon": round(random.uniform(-180, 180), 6)
                }
            }
            clean_and_log(data)
            time.sleep(2)
    except KeyboardInterrupt:
        print("\n⏹️ IoT runner stopped manually")

# ---------------------------
# Main Entrypoint
# ---------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["hardware", "simulated"], required=True)
    parser.add_argument("--port", help="Serial port for hardware mode")
    parser.add_argument("--baud", type=int, default=115200)
    args = parser.parse_args()

    config = {}  # later can load from config.json if needed

    if args.mode == "hardware":
        run_hardware(config, args.port, args.baud)
    else:
        run_simulated(config)
