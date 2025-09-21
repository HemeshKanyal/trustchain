from sqlalchemy import Column, Integer, String, DateTime, func, Text
from .base import Base

class CustodyRule(Base):
    __tablename__ = "custody_rules"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

class CustodyAudit(Base):
    __tablename__ = "custody_audit"
    id = Column(Integer, primary_key=True)
    batch_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    performed_by = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
