from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.post("/", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.wallet_address == payload.wallet_address).first()
    if exists:
        raise HTTPException(status_code=400, detail="User already exists")
    u = models.User(**payload.dict())
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.get("/{wallet_address}", response_model=schemas.UserOut)
def get_user(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.wallet_address == wallet_address).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
