from sqlalchemy import Column, Float, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from ..db import Base

class IoTLog(Base):
    __tablename__ = "iot_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    rfid_tag = Column(String, index=True)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    gps_lat = Column(Float, nullable=True)
    gps_lon = Column(Float, nullable=True)

    # ✅ Correct ForeignKey with UUID
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"))

    # ✅ Relationship back to Batch
    batch = relationship("Batch", back_populates="iot_logs")
