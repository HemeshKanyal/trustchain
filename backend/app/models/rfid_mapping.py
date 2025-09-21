from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from .base import Base

class RFIDMapping(Base):
    __tablename__ = "rfid_mapping"
    id = Column(Integer, primary_key=True)
    rfid_tag = Column(String, unique=True, nullable=False, index=True)
    batch_id = Column(String, ForeignKey("batches.batch_id"), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
