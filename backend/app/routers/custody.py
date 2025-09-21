# app/routes/custody.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import CustodyAudit, RFIDMapping, Batch, TransitMapping, User, CustodyRule
from app.services import blockchain
import os
import datetime

router = APIRouter(
    prefix="/custody",
    tags=["Custody Audit"]
)

# Load default blockchain private key (for testing – replace with wallet management later)
DEFAULT_PRIV_KEY = os.getenv("DEFAULT_PRIV_KEY", "0xYourPrivateKeyHere")
DEFAULT_ACCOUNT = os.getenv("DEFAULT_ACCOUNT", "0xYourAccountHere")


# ---------------------------
# 1. Get custody records by Batch ID (UUID)
# ---------------------------
@router.get("/batch/{batch_id}")
def get_custody_records(batch_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(CustodyAudit)
        .filter(CustodyAudit.batch_id == batch_id)
        .all()
    )
    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"No custody records found for batch_id: {batch_id}"
        )
    return records


# ---------------------------
# 2. Get custody records by RFID tag
# ---------------------------
@router.get("/rfid/{rfid_tag}")
def get_custody_by_rfid(rfid_tag: str, db: Session = Depends(get_db)):
    mapping = (
        db.query(RFIDMapping)
        .filter(RFIDMapping.rfid_tag == rfid_tag, RFIDMapping.active == True)
        .first()
    )
    if not mapping:
        raise HTTPException(status_code=404, detail=f"RFID {rfid_tag} not mapped")

    batch_id = str(mapping.batch_id)
    records = db.query(CustodyAudit).filter(CustodyAudit.batch_id == batch_id).all()

    if not records:
        raise HTTPException(status_code=404, detail=f"No custody records for RFID {rfid_tag}")

    return {
        "rfid_tag": rfid_tag,
        "batch_id": batch_id,
        "custody_records": records
    }


# ---------------------------
# 3. IoT-driven custody transfer (main entry point)
# ---------------------------
@router.post("/transfer/{rfid_tag}/{to_user_id}")
def transfer_custody(rfid_tag: str, to_user_id: str, db: Session = Depends(get_db)):
    """
    Transfer custody of a batch using IoT RFID scan.
    - RFID tag must be mapped to a batch.
    - Validates custody rules before transfer.
    - Logs custody event on blockchain and in DB.
    """

    # 1. Resolve RFID → batch
    rfid_map = db.query(RFIDMapping).filter(
        RFIDMapping.rfid_tag == rfid_tag, RFIDMapping.active == True
    ).first()
    if not rfid_map:
        raise HTTPException(status_code=404, detail="RFID not mapped to any batch")

    batch = db.query(Batch).filter(Batch.id == rfid_map.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found for this RFID")

    # 2. Last custody record → current holder
    last_custody = (
        db.query(CustodyAudit)
        .filter(CustodyAudit.batch_id == batch.batch_id)
        .order_by(CustodyAudit.timestamp.desc())
        .first()
    )

    from_user = (
        db.query(User).filter(User.id == last_custody.to_user_id).first()
        if last_custody else None
    )
    to_user = db.query(User).filter(User.id == to_user_id).first()

    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient user not found")

    # 3. Validate custody rules
    if from_user:
        rule = (
            db.query(CustodyRule)
            .filter(
                CustodyRule.from_role == from_user.role,
                CustodyRule.to_role == to_user.role
            )
            .first()
        )
        if not rule:
            raise HTTPException(status_code=400, detail="Invalid custody transfer: role mismatch")

    # 4. Blockchain custody transfer
    tx_hash = blockchain.distributor_receive(
        int(batch.batch_id), DEFAULT_PRIV_KEY
    ) if not last_custody else blockchain.distributor_complete_transit(
        int(batch.batch_id), DEFAULT_PRIV_KEY
    )

    # 5. Save custody audit record
    custody = CustodyAudit(
        batch_id=batch.batch_id,
        from_user_id=from_user.id if from_user else None,
        to_user_id=to_user.id,
        from_role=from_user.role if from_user else None,
        to_role=to_user.role,
        rfid_tag=rfid_tag,
        tx_hash=tx_hash,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(custody)
    db.commit()
    db.refresh(custody)

    return {
        "status": "success",
        "batch_id": batch.batch_id,
        "from": from_user.wallet_address if from_user else None,
        "to": to_user.wallet_address,
        "tx_hash": tx_hash,
        "custody_id": str(custody.id),
    }


# ---------------------------
# 4. Start transit to another party (optional)
# ---------------------------
@router.post("/start/{batch_id}")
def start_custody(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    try:
        transit_id = blockchain.distributor_create_transit(
            distributor=DEFAULT_ACCOUNT,
            batch_id=batch_id,
            priv_key=DEFAULT_PRIV_KEY
        )
        mapping = TransitMapping(batch_id=batch_id, transit_id=transit_id)
        db.add(mapping)
        db.commit()
        return {"batch_id": batch_id, "transit_id": transit_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain error: {str(e)}")

# ---------------------------
# 5. IoT Device → Record Checkpoint (Unified with IoT runner logic)
# ---------------------------
@router.post("/checkpoint/rfid/{rfid_tag}")
def distributor_checkpoint_rfid(rfid_tag: str, location: str, metadata: str, db: Session = Depends(get_db)):
    # Lookup mapping
    mapping = db.query(RFIDMapping).filter(
        RFIDMapping.rfid_tag == rfid_tag,
        RFIDMapping.active == True
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail=f"RFID {rfid_tag} not mapped to any batch")

    batch_id = mapping.batch_id

    # Lookup transit
    transit_map = db.query(TransitMapping).filter(
        TransitMapping.batch_id == batch_id
    ).first()
    if not transit_map:
        raise HTTPException(status_code=404, detail=f"No transit mapping found for batch {batch_id}")

    transit_id = transit_map.transit_id

    try:
        # Blockchain call
        tx_hash = blockchain.distributor_record_checkpoint(
            transit_id=transit_id,
            location=location,
            metadata=metadata,
            priv_key=os.getenv("DEFAULT_PRIV_KEY")
        )

        # Record in DB
        custody = CustodyAudit(
            batch_id=batch_id,
            from_role="IoT",
            to_role="Blockchain",
            rfid_tag=rfid_tag,
            tx_hash=tx_hash,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(custody)
        db.commit()

        return {"status": "checkpoint_added", "batch_id": str(batch_id), "transit_id": transit_id, "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------
# 6. Complete Transit (final delivery)
# ---------------------------
@router.post("/complete/{transit_id}")
def distributor_complete(transit_id: int, db: Session = Depends(get_db)):
    try:
        tx_hash = blockchain.distributor_complete_transit(transit_id, DEFAULT_PRIV_KEY)

        mapping = db.query(TransitMapping).filter_by(transit_id=transit_id).first()
        batch_id = mapping.batch_id if mapping else None

        audit = CustodyAudit(
            batch_id=batch_id,
            rfid_tag=None,
            from_role="Distributor",
            to_role="Retailer",
            from_user_id=None,
            to_user_id=None,
            tx_hash=tx_hash,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        return {"status": "transit_completed", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
