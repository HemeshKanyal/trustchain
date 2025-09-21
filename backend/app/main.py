# app/main.py

import importlib
import pkgutil
import asyncio
from fastapi import FastAPI
from .db import Base, engine
from . import routers
from .services.iot_runner import start_iot_runner
from .services.blockchain import w3, contracts
from scripts.seed_rules import seed_rules
from app.services.event_listener import start_listeners
from app.routers import alerts

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PharmaTrack API",
    version="1.0.0",
    description="Backend for pharma supply chain tracking with IoT, custody, and alerts"
)
app.include_router(alerts.router)


# Dynamically include all routers from routers/
for module_info in pkgutil.iter_modules(routers.__path__):
    module_name = f"{routers.__name__}.{module_info.name}"
    module = importlib.import_module(module_name)
    if hasattr(module, "router"):
        app.include_router(module.router, prefix=f"/{module_info.name}")


@app.get("/")
def root():
    return {"message": "PharmaTrack API is running 🚀"}


# -----------------------------
# Blockchain Event Listener Task
# -----------------------------
async def watch_all_contracts():
    """Continuously listen for all events from all contracts."""
    event_filters = []

    # Create filters for each contract
    for name, contract in contracts.items():
        try:
            # get_all_event_types() is not native, so loop ABI
            for abi in contract.abi:
                if abi.get("type") == "event":
                    event = getattr(contract.events, abi["name"])
                    event_filters.append((name, abi["name"], event.create_filter(fromBlock="latest")))
                    print(f"👂 Listening for {abi['name']} events on {name} contract")
        except Exception as e:
            print(f"⚠️ Could not create filters for {name}: {e}")

    # Poll loop
    while True:
        try:
            for name, ev_name, ev_filter in event_filters:
                for event in ev_filter.get_new_entries():
                    print(f"📢 {name}.{ev_name} Event: {event['args']}")
                    # TODO: save to DB, notify frontend, trigger alerts, etc.
        except Exception as e:
            print("⚠️ Event listener error:", e)

        await asyncio.sleep(2)


# ✅ Startup event
@app.on_event("startup")
async def startup_event():
    # Start IoT runner
    start_iot_runner()

    # Seed default rules
    seed_rules()

    # Start blockchain listeners
    loop = asyncio.get_event_loop()
    loop.create_task(watch_all_contracts())
    asyncio.create_task(start_listeners())

# ✅ Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    print("👋 Shutting down PharmaTrack API, closing blockchain listeners...")
    # No explicit disconnect needed for Web3 WS
