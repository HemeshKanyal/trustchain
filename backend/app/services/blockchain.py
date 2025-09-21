# app/services/blockchain.py

from web3 import Web3
import json
import os
from pathlib import Path
from app.config import settings


# -----------------------------
# 1. Blockchain Connection (WebSocket)
# -----------------------------
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", settings.WEB3_PROVIDER)

# Detect protocol: use WebsocketProvider if starts with wss://
if WEB3_PROVIDER.startswith("wss://"):
    w3 = Web3(Web3.LegacyWebSocketProvider(WEB3_PROVIDER))
else:
    w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

print("Connecting to:", WEB3_PROVIDER)
try:
    latest_block = w3.eth.block_number
    print("✅ Connected via Web3. Latest block:", latest_block)
except Exception as e:
    print("❌ Web3 connection failed:", e)


# -----------------------------
# 2. Helper: Load Contract
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # backend/app
CONTRACTS_DIR = BASE_DIR.parent / "contracts" / "abis"

def load_contract(abi_filename: str, address: str):
    """Load a contract from ABI file + deployed address"""
    abi_path = CONTRACTS_DIR / abi_filename
    if not abi_path.exists():
        raise FileNotFoundError(f"ABI not found: {abi_path}")

    with open(abi_path, "r") as f:
        abi = json.load(f)

    return w3.eth.contract(address=address, abi=abi)


# -----------------------------
# 3. Contracts Registry
# -----------------------------
contracts = {}

contract_configs = {
    "distributor": ("Distributor.json", settings.DISTRIBUTOR_CONTRACT_ADDRESS),
    "manufacturer": ("Manufacturer.json", settings.MANUFACTURER_CONTRACT_ADDRESS),
    "admin": ("Admin.json", settings.ADMIN_CONTRACT_ADDRESS),
    "pharmacy": ("Pharmacy.json", settings.PHARMACY_CONTRACT_ADDRESS),
    "patient": ("Patient.json", settings.PATIENT_CONTRACT_ADDRESS),
    "prescription": ("Prescription.json", settings.PRESCRIPTION_CONTRACT_ADDRESS),
    "doctor_registry": ("DoctorRegistry.json", settings.DOCTORREGISTERY_CONTRACT_ADDRESS),
    "iot_tracker": ("IotTracker.json", settings.IOTTRACKER_CONTRACT_ADDRESS),
}

for name, (abi_file, addr) in contract_configs.items():
    if addr and not addr.startswith("0xYour"):  # skip placeholders
        try:
            contracts[name] = load_contract(abi_file, addr)
            print(f"✅ Loaded contract: {name} ({addr})")
        except Exception as e:
            print(f"⚠️ Failed to load {name}: {e}")


# -----------------------------
# 4. Generic Transaction Sender
# -----------------------------
def send_tx(sender_private_key: str, contract_name: str, fn_name: str, *args):
    """Send a transaction to any contract by name"""
    if contract_name not in contracts:
        raise ValueError(f"Contract '{contract_name}' not loaded")

    contract = contracts[contract_name]
    account = w3.eth.account.from_key(sender_private_key)

    fn = contract.get_function_by_name(fn_name)(*args)
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 3_000_000,
        "gasPrice": w3.to_wei("5", "gwei"),
    })

    signed_tx = w3.eth.account.sign_transaction(tx, sender_private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

    return w3.to_hex(tx_hash)


# -----------------------------
# 5. Example Wrappers (optional)
# -----------------------------
def distributor_receive(batch_id: int, sender_private_key: str):
    return send_tx(sender_private_key, "distributor", "receiveFromManufacturer", batch_id)

def distributor_start_transit(batch_id: int, to_address: str, sender_private_key: str):
    return send_tx(sender_private_key, "distributor", "startTransit", batch_id, to_address)

def distributor_record_checkpoint(transit_id: int, location: str, metadata: str, sender_private_key: str):
    return send_tx(sender_private_key, "distributor", "recordCheckpoint", transit_id, location, metadata)

def distributor_complete_transit(transit_id: int, sender_private_key: str):
    return send_tx(sender_private_key, "distributor", "completeTransit", transit_id)


# -----------------------------
# 6. Example Event Listener
# -----------------------------
def listen_to_events(contract_name: str, event_name: str, poll_interval: int = 2):
    """Listen to contract events in real-time (blocking loop)"""
    if contract_name not in contracts:
        raise ValueError(f"Contract '{contract_name}' not loaded")

    contract = contracts[contract_name]
    event_filter = contract.events.MyEvent.create_filter()


    print(f"👂 Listening for {event_name} events on {contract_name}...")

    while True:
        for event in event_filter.get_new_entries():
            print("📢 Event received:", event)
        import time
        time.sleep(poll_interval)
