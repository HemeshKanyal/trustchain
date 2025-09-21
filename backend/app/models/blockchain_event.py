# app/models/blockchain_event.py

from sqlalchemy import Column, Integer, String, DateTime, JSON, func
from app.db import Base

class BlockchainEvent(Base):
    __tablename__ = "blockchain_events"

    id = Column(Integer, primary_key=True, index=True)
    contract_name = Column(String, nullable=False)
    event_name = Column(String, nullable=False)
    tx_hash = Column(String, nullable=False, index=True)
    block_number = Column(Integer, nullable=False)
    args = Column(JSON, nullable=False)  # store decoded event params
    created_at = Column(DateTime(timezone=True), server_default=func.now())
