import serial
import json, os
import threading
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import IoTLog, CustodyAudit, Alert, Batch, CustodyRule, RFIDMapping, TransitMapping
from datetime import datetime
from app.services import blockchain

SERIAL_PORT = "COM5"
BAUD_RATE = 115200

last_rfid = None

def parse_serial_line(line: str):
    try:
        return json.loads(line.strip())
    except:
        return None


def process_iot_data(data: dict, db: Session):
    global last_rfid

    rfid = data.get("rfid_tag")
    temp = data.get("temperature")
    hum = data.get("humidity")
    gps = data.get("gps", {})
    lat = gps.get("lat")
    lon = gps.get("lon")

    new_rfid_detected = False
    if rfid and rfid.strip():
        if rfid != last_rfid:
            new_rfid_detected = True
        last_rfid = rfid
    else:
        rfid = last_rfid  

    if not rfid:
        return

    # ✅ Map RFID -> batch_id (UUID)
    mapping = db.query(RFIDMapping).filter(
        RFIDMapping.rfid_tag == rfid,
        RFIDMapping.active == True
    ).first()

    if not mapping:
        alert = Alert(
            batch_id="UNKNOWN",
            issue_type="RFID_ERROR",
            severity="High",
            description=f"Unknown RFID scanned: {rfid}"
        )
        db.add(alert)
        db.commit()
        return

    batch_id = mapping.batch_id  # UUID
    batch = db.query(Batch).filter(Batch.id == batch_id).first()

    if not batch:
        alert = Alert(
            batch_id=batch_id,
            issue_type="BATCH_ERROR",
            severity="High",
            description=f"No batch found for RFID {rfid}"
        )
        db.add(alert)
        db.commit()
        return

    # ✅ Log IoT data
    log = IoTLog(
        batch_id=batch_id,
        rfid_tag=rfid,
        temperature=temp,
        humidity=hum,
        gps_lat=lat,
        gps_lon=lon,
        logged_at=datetime.utcnow()
    )
    db.add(log)

    # ✅ Custody update when RFID changes
    if new_rfid_detected:
        last_custody = db.query(CustodyAudit).filter(
            CustodyAudit.batch_id == batch_id
        ).order_by(CustodyAudit.timestamp.desc()).first()

        from_role = last_custody.to_role if last_custody else "Manufacturer"

        rule = db.query(CustodyRule).filter(
            CustodyRule.from_role == from_role
        ).first()

        if rule:
            tx_hash = "pending"
            try:
                # ---- Blockchain checkpoint ----
                metadata = json.dumps({
                    "temp": temp,
                    "hum": hum,
                    "gps": {"lat": lat, "lon": lon}
                })

                # ✅ Lookup transit_id from TransitMapping
                transit_map = db.query(TransitMapping).filter(
                    TransitMapping.batch_id == batch_id
                ).first()
                transit_id = transit_map.transit_id if transit_map else None

                if not transit_id:
                    alert = Alert(
                        batch_id=batch_id,
                        issue_type="TRANSIT_ERROR",
                        severity="High",
                        description=f"No transit_id found for batch {batch_id}"
                    )
                    db.add(alert)
                    db.commit()
                    return

                tx_hash = blockchain.distributor_record_checkpoint(
                    transit_id=transit_id,
                    location=f"{lat},{lon}",
                    metadata=metadata,
                    priv_key=os.getenv("DEFAULT_PRIV_KEY")
                )
            except Exception as e:
                tx_hash = f"error: {str(e)}"

            custody = CustodyAudit(
                batch_id=batch_id,
                from_role=from_role,
                to_role=rule.to_role,
                rfid_tag=rfid,
                tx_hash=tx_hash
            )
            db.add(custody)
        else:
            alert = Alert(
                batch_id=batch_id,
                issue_type="CUSTODY_ERROR",
                severity="Medium",
                description=f"No valid custody transition from {from_role} for batch {batch_id}"
            )
            db.add(alert)

    db.commit()


def iot_listener():
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    db = SessionLocal()

    while True:
        try:
            raw = ser.readline()
            try:
                line = raw.decode("utf-8").strip()
                if line:
                    print(f"[IoT Raw] {line}") 
            except UnicodeDecodeError:
                print(f"[IoT Runner] Non-UTF8 data: {raw}")
                continue

            if not line:
                continue
            data = parse_serial_line(line)
            if data:
                process_iot_data(data, db)
        except Exception as e:
            print(f"[IoT Runner] Error: {e}")


def start_iot_runner():
    t = threading.Thread(target=iot_listener, daemon=True)
    t.start()
