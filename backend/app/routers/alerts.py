from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/alerts", tags=["alerts"])

# ✅ Create alert
@router.post("/", response_model=schemas.AlertOut)
def create_alert(payload: schemas.AlertCreate, db: Session = Depends(get_db)):
    alert = models.Alert(
        batch_id=payload.batch_id,
        issue_type=payload.issue_type,
        severity=payload.severity,
        description=payload.description
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

# ✅ Get alerts for a specific batch
@router.get("/{batch_id}", response_model=List[schemas.AlertOut])
def get_alerts_by_batch(batch_id: str, db: Session = Depends(get_db)):
    alerts = db.query(models.Alert).filter(models.Alert.batch_id == batch_id).all()
    return alerts

# ✅ Get all alerts
@router.get("/", response_model=List[schemas.AlertOut])
def get_all_alerts(db: Session = Depends(get_db)):
    alerts = db.query(models.Alert).order_by(models.Alert.created_at.desc()).all()
    return alerts
