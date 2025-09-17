# iot_runner.py
import time
import random
import json
import hashlib

# ===============================
# 🔗 Blockchain Hooks (placeholders)
# ===============================
def fetch_batch_metadata(batch_id):
    """
    FUTURE HOOK:
    Fetch batch details (valid RFID tags, allowed temp/humidity ranges, etc.)
    from blockchain smart contract.
    """
    return {
        "batch_id": batch_id,
        "valid_rfids": ["MED123456", "MED987654", "MED543210"],
        "temp_range": (2, 8),          # °C
        "humidity_range": (30, 60),    # %
    }

def push_iot_event_to_blockchain(event_data):
    """
    FUTURE HOOK:
    Write IoT event logs (RFID, GPS, Temp, Humidity, Flags) to blockchain.
    """
    print(f"[Blockchain Hook] Event pushed: {event_data}")

def verify_medicine_status(rfid_tag):
    """
    FUTURE HOOK:
    Check if medicine RFID is already marked as 'sold', 'returned', or 'in transit'
    on blockchain.
    """
    return {"rfid_tag": rfid_tag, "status": "in_transit"}

def update_medicine_status(rfid_tag, status):
    """
    FUTURE HOOK:
    Update the medicine status on blockchain (sold, returned, recalled, expired).
    """
    print(f"[Blockchain Hook] RFID {rfid_tag} status updated to {status}")

def fetch_audit_trail(batch_id):
    """
    FUTURE HOOK:
    Fetch complete IoT + transaction history for a batch from blockchain.
    """
    return [{"timestamp": int(time.time()), "rfid_tag": "MED987654", "event": "in_transit"}]

# ===============================
# ⚙️ IoT Emulator + Validator
# ===============================
def generate_sensor_data(batch_id, valid_rfids):
    """Simulate IoT device readings for RFID, temp, humidity, GPS."""
    rfid_tag = random.choice(valid_rfids)

    data = {
        "batch_id": batch_id,
        "timestamp": time.time(),
        "rfid_tag": rfid_tag,
        "temperature": round(random.uniform(15, 30), 2),  # °C
        "humidity": round(random.uniform(40, 80), 2),    # %
        "gps": {
            "lat": round(random.uniform(19.0, 28.7), 2),  # India coords
            "lon": round(random.uniform(72.8, 88.4), 2)
        }
    }

    # Create hash for tamper-proofing
    record_str = json.dumps(data, sort_keys=True)
    data["hash"] = hashlib.sha256(record_str.encode()).hexdigest()
    return data

def validate_data(event, temp_range, humidity_range):
    """Validate IoT data and raise flags if violations occur."""
    flags = {
        "temperature_violation": not (temp_range[0] <= event["temperature"] <= temp_range[1]),
        "humidity_violation": not (humidity_range[0] <= event["humidity"] <= humidity_range[1]),
        "gps_deviation": False  # placeholder: add geo-fencing later
    }
    return flags

def main():
    batch_id = "BATCH001"

    # 🔗 Fetch batch metadata from blockchain
    metadata = fetch_batch_metadata(batch_id)
    valid_rfids = metadata["valid_rfids"]
    temp_range = metadata["temp_range"]
    humidity_range = metadata["humidity_range"]

    print(f"🚀 IoT Runner Started for {batch_id}")

    with open("iot_logs.jsonl", "a") as log_file:
        for _ in range(5):  # simulate 5 readings
            event = generate_sensor_data(batch_id, valid_rfids)

            # ✅ Validate
            flags = validate_data(event, temp_range, humidity_range)
            event["flags"] = flags

            # 📝 Log locally
            log_file.write(json.dumps(event) + "\n")
            print(json.dumps(event, indent=4))

            # 🔗 Push to blockchain (future-ready)
            push_iot_event_to_blockchain(event)

            time.sleep(2)  # simulate delay

if __name__ == "__main__":
    main()
