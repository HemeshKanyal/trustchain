# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:Database%4012345@localhost/trustchain"
    DEBUG: bool = True

    WEB3_PROVIDER: str
    DEFAULT_PRIV_KEY: str
    DISTRIBUTOR_CONTRACT_ADDRESS: str
    MANUFACTURER_CONTRACT_ADDRESS: str
    ADMIN_CONTRACT_ADDRESS: str
    PHARMACY_CONTRACT_ADDRESS: str
    PATIENT_CONTRACT_ADDRESS: str
    PRESCRIPTION_CONTRACT_ADDRESS: str
    DOCTORREGISTERY_CONTRACT_ADDRESS: str
    IOTTRACKER_CONTRACT_ADDRESS: str

    class Config:
        env_file = ".env"

settings = Settings()
