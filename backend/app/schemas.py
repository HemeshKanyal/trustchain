from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

# ---------------- USERS ----------------
class UserCreate(BaseModel):
    wallet_address: str
    role: str
    name: Optional[str] = None
    email: Optional[str] = None

class UserOut(UserCreate):
    id: UUID
    created_at: datetime
    last_login: Optional[datetime] = None

# ---------------- BATCHES ----------------
class BatchCreate(BaseModel):
    batch_id: str
    manufacturer: Optional[str] = None
    medicine_name: Optional[str] = None
    expiry_date: Optional[datetime] = None

class BatchOut(BatchCreate):
    id: UUID
    created_at: datetime

# ---------------- IOT LOGS ----------------
class IoTLogCreate(BaseModel):
    batch_id: str
    rfid_tag: str
    temperature: float
    humidity: float
    gps_lat: float
    gps_lon: float
    fault_detected: Optional[bool] = False

class IoTLogOut(IoTLogCreate):
    id: UUID
    logged_at: datetime

# ---------------- CUSTODY AUDIT ----------------
class CustodyAuditCreate(BaseModel):
    batch_id: str
    from_role: str
    to_role: str
    tx_hash: str

class CustodyAuditOut(CustodyAuditCreate):
    id: UUID
    timestamp: datetime

# ---------------- ALERTS ----------------
class AlertCreate(BaseModel):
    batch_id: str
    issue_type: str
    severity: str
    description: Optional[str] = None

class AlertOut(AlertCreate):
    id: UUID
    detected_at: datetime
    resolved: bool



class AlertBase(BaseModel):
    message: str

class AlertCreate(AlertBase):
    batch_id: UUID

class AlertResponse(AlertBase):
    id: UUID
    batch_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True