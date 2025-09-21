import asyncio
import time
from datetime import datetime
from web3 import Web3
from app.db import SessionLocal
from app.models import Batch, IoTLog, Alert

# Import contracts dict from your blockchain connector
from app.services.blockchain import contracts  

# --- Event Handlers ---

def check_rules_and_alert(log, session):
    """Apply custody/quality rules and generate alerts if needed"""
    if log.temperature is not None and log.temperature > 30:
        alert = Alert(
            batch_id=log.batch_id,
            message=f"⚠️ High temperature detected: {log.temperature}°C",
            created_at=datetime.utcnow()
        )
        session.add(alert)

    if log.humidity is not None and log.humidity < 20:
        alert = Alert(
            batch_id=log.batch_id,
            message=f"⚠️ Low humidity detected: {log.humidity}%",
            created_at=datetime.utcnow()
        )
        session.add(alert)

    session.commit()


def handle_event(event, session):
    """Route blockchain event to DB model"""
    args = event["args"]
    event_name = event["event"]

    if event_name == "BatchCreated":
        batch = Batch(
            id=args.get("batchId"),
            batch_number=args.get("batchNumber"),
            created_at=datetime.utcnow()
        )
        session.add(batch)
        session.commit()
        print(f"✅ Stored new batch {batch.batch_number}")

    elif event_name == "IoTLogRecorded":
        log = IoTLog(
            id=args.get("logId"),
            rfid_tag=args.get("rfid"),
            temperature=float(args.get("temperature", 0)),
            humidity=float(args.get("humidity", 0)),
            gps_lat=float(args.get("lat", 0)),
            gps_lon=float(args.get("lon", 0)),
            batch_id=args.get("batchId")
        )
        session.add(log)
        session.commit()
        print(f"📡 IoTLog saved for batch {log.batch_id}")

        # Run rules after saving
        check_rules_and_alert(log, session)


async def listen_to_events(contract_name: str, event_name: str, poll_interval: int = 2):
    """Listen to contract events in real-time"""
    if contract_name not in contracts:
        print(f"❌ Contract '{contract_name}' not found")
        return

    contract = contracts[contract_name]

    try:
        event_filter = getattr(contract.events, event_name).create_filter("latest")
    except Exception as e:
        print(f"⚠️ Could not create filter for {event_name} in {contract_name}: {e}")
        return

    print(f"👂 Listening for {event_name} on {contract_name}...")

    session = SessionLocal()

    while True:
        try:
            for event in event_filter.get_new_entries():
                print(f"📢 Event received: {event}")
                handle_event(event, session)
        except Exception as e:
            print(f"❌ Error processing event {event_name}: {e}")

        await asyncio.sleep(poll_interval)


async def start_listeners():
    """Start event listeners for all relevant contracts"""
    listeners = [
        listen_to_events("manufacturer", "BatchCreated"),
        listen_to_events("iot_tracker", "IoTLogRecorded"),
    ]

    await asyncio.gather(*listeners)
