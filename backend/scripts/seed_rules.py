import sys
import os

# Ensure app/ is on the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal, engine
from app import models

def seed_rules():
    db = SessionLocal()

    try:
        # Ensure tables exist
        models.Base.metadata.create_all(bind=engine)

        # --- Example Batches ---
        if not db.query(models.Batch).first():
            batch1 = models.Batch(
                batch_id="14ba758e",  # matches RFID tag from IoT
                product_name="COVID Vaccine A",
                manufacturer="PharmaCorp",
                manufacture_date="2025-09-01",
                expiry_date="2026-09-01"
            )
            batch2 = models.Batch(
                batch_id="RFID1234",
                product_name="Malaria Medicine B",
                manufacturer="MedLife",
                manufacture_date="2025-08-01",
                expiry_date="2026-08-01"
            )
            db.add_all([batch1, batch2])
            print("[Seed] Batches inserted")

        # --- Example Users ---
        if not db.query(models.User).first():
            user1 = models.User(
            role="Distributor",
            wallet_address="0xDIST1234567890abcdef")  # dummy value
            
            user2 = models.User(
            role="Transporter",
            wallet_address="0xTRAN1234567890abcdef")  # dummy value
            
            db.add_all([user1, user2])
            db.commit()
            print("[Seed] Users inserted")

        db.commit()
        print("[Seed] Done ✅")

    except Exception as e:
        print(f"[Seed] Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_rules()
