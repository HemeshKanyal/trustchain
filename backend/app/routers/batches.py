from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas

router = APIRouter(prefix="/batches", tags=["batches"])

@router.post("/", response_model=schemas.BatchOut)
def create_batch(payload: schemas.BatchCreate, db: Session = Depends(get_db)):
    b = models.Batch(
        batch_id=payload.batch_id,
        manufacturer=payload.manufacturer,
        medicine_name=payload.medicine_name,
        expiry_date=payload.expiry_date
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b

@router.get("/{batch_id}", response_model=schemas.BatchOut)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch
