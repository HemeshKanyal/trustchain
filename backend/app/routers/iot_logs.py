from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from datetime import datetime

router = APIRouter(
    prefix="/iot-logs",
    tags=["IoT Logs"]
)

@router.post('/ingest', response_model=schemas.IoTLogOut)
def ingest_iot(payload: schemas.IoTLogCreate, db: Session = Depends(get_db)):

    # simple flow: find batch by payload.batch_id or lookup by rfid if batch_id none
    batch_id = payload.batch_id
    if not batch_id and payload.rfid_tag:
        # try to map RFID -> batch
        batch = db.query(models.Batch).filter(models.Batch.batch_id==payload.rfid_tag).first()
        if batch:
            batch_id = batch.batch_id

    if not batch_id:
        # allow ingestion but mark unknown
        batch_id = None

    log = models.IoTLog(
        batch_id=batch_id,
        rfid_tag=payload.rfid_tag,
        temperature=payload.temperature,
        humidity=payload.humidity,
        gps_lat=payload.gps.get('lat') if payload.gps else None,
        gps_lon=payload.gps.get('lon') if payload.gps else None,
        logged_at=payload.logged_at or datetime.utcnow()
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # simple fault detection example: temp out of threshold
    faults = False
    cfg = {
        'temp_min': 15, 'temp_max': 25,
        'hum_min': 45, 'hum_max': 70
    }
    if payload.temperature is not None:
        if payload.temperature < cfg['temp_min'] or payload.temperature > cfg['temp_max']:
            faults = True
            # create alert
            alert = models.Alert(
                batch_id=batch_id,
                issue_type='temperature',
                severity='high',
                description=f'Temperature out of range: {payload.temperature}'
            )
            db.add(alert)
            db.commit()

    return {"ok": True, "id": str(log.id), "fault": faults}
