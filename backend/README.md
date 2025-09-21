# TrustChain Backend (FastAPI)

1) create a Python virtualenv
2) pip install -r requirements.txt
3) configure DATABASE_URL in backend/.env or edit app/config.py
4) run: uvicorn app.main:app --reload

API endpoints:
- POST /api/batch/         -> create batch
- GET  /api/batch/{id}     -> get batch
- POST /api/iot/ingest     -> ingest IoT payload
