from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float, Text, Enum, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from .db import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(100), unique=True, index=True, nullable=False)
    role = Column(String(50), nullable=False)
    name = Column(String(200))
    email = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

class Batch(Base):
    __tablename__ = 'batches'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(String(200), unique=True, index=True, nullable=False)
    manufacturer = Column(String(200))
    medicine_name = Column(String(200))
    expiry_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    transit_mapping = relationship("TransitMapping", back_populates="batch", uselist=False)


class IoTLog(Base):
    __tablename__ = 'iot_logs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(String(200), index=True)
    rfid_tag = Column(String(200), index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    gps_lat = Column(Float)
    gps_lon = Column(Float)
    fault_detected = Column(Boolean, default=False)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())

class CustodyAudit(Base):
    __tablename__ = 'custody_audit'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(String(200), index=True, nullable=False)

    # Who handed over / received custody
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    from_role = Column(String(100))   # e.g., "Distributor"
    to_role = Column(String(100))     # e.g., "Transporter"

    rfid_tag = Column(String(200), index=True)  # scanned RFID from hardware
    tx_hash = Column(String(200))               # blockchain tx hash if needed
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = 'alerts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(String(200), index=True)
    issue_type = Column(String(100))
    severity = Column(String(50))
    description = Column(Text)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)


class CustodyRule(Base):
    __tablename__ = "custody_rules"
    id = Column(Integer, primary_key=True, index=True)
    from_role = Column(String, nullable=False)
    to_role = Column(String, nullable=False)

class RFIDMapping(Base):
    __tablename__ = "rfid_mapping"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfid_tag = Column(String(200), unique=True, nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default="now()")



class TransitMapping(Base):
    __tablename__ = "transit_mapping"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), unique=True, nullable=False)
    transit_id = Column(Integer, nullable=False)

    batch = relationship("Batch", back_populates="transit_mapping")