# app/services/rules_engine.py

from app import db
from app.models.alert import Alert
from app.models.blockchain_event import BlockchainEvent

"""
Rules engine:
- Called from main.py when a blockchain event is stored.
- Evaluates the event against simple rules and generates alerts if needed.
"""

def evaluate_event(event: dict):
    """
    event = {
        "id": db_event.id,
        "contract_name": str,
        "event_name": str,
        "tx_hash": str,
        "block_number": int,
        "args": dict
    }
    """
    try:
        session = db.SessionLocal()
        alerts = []

        # Example rules — you can expand these
        if event["contract_name"] == "iot_tracker" and event["event_name"] == "TemperatureRecorded":
            temp = event["args"].get("temperature", 0)
            if temp > 30:  # threshold
                alerts.append(Alert(
                    rule_name="High Temperature",
                    event_id=event["id"],
                    description=f"Temperature exceeded safe limit: {temp}°C",
                    metadata=event
                ))

        if event["contract_name"] == "distributor" and event["event_name"] == "TransitDelayed":
            alerts.append(Alert(
                rule_name="Transit Delay",
                event_id=event["id"],
                description="A distributor transit was delayed",
                metadata=event
            ))

        # Save alerts to DB
        for alert in alerts:
            session.add(alert)
        if alerts:
            session.commit()
            print(f"🚨 Generated {len(alerts)} alert(s) for event {event['id']}")

        session.close()

    except Exception as e:
        print("⚠️ Rules engine error:", e)
