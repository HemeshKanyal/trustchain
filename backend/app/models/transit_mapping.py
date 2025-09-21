from sqlalchemy import Column, Integer, String, ForeignKey
from .base import Base

class TransitMapping(Base):
    __tablename__ = "transit_mapping"
    id = Column(Integer, primary_key=True)
    batch_id = Column(String, ForeignKey("batches.batch_id"), nullable=False)
    transit_id = Column(Integer, nullable=False)
