"""Application settings, mirroring backend/src/main/resources/application.yml
env-var-for-env-var so the Python backend can be dropped in behind the same
deployment environment as the Java backend.

Every setting below corresponds 1:1 to an `${ENV_VAR:default}` in application.yml.
Do not rename a field without keeping the same env var name via `alias`.
"""
from __future__ import annotations

import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_DEFAULT_JWT_SECRET = "change-me-dev-only-secret-change-me-dev-only-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- server ----
    PORT: int = 8080
    SERVER_PORT: int = 8080

    # ---- datasource ----
    # NOTE: Java used `jdbc:postgresql://...`; the Python app needs a plain
    # `postgresql+asyncpg://` DSN. See db/session.py for the translation.
    DB_URL: str = "jdbc:postgresql://localhost:5432/ecotrack"
    DB_USER: str = "ecotrack"
    DB_PASSWORD: str = "ecotrack"
    DB_POOL_MAX: int = 10

    # ---- CORS ----
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3002"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]

    # ---- security / jwt ----
    JWT_SECRET: str = DEV_DEFAULT_JWT_SECRET
    JWT_ACCESS_TTL: int = 900
    JWT_REFRESH_TTL: int = 1209600
    JWT_ISSUER: str = "ecotrack"

    # ---- security / google ----
    GOOGLE_CLIENT_ID: str = ""

    # ---- storage ----
    STORAGE_PROVIDER: str = "local_stub"
    GCP_PROJECT_ID: str = ""
    GCS_BUCKET: str = "carbonexo-bills"
    STORAGE_LOCAL_DIR: str = "./.local-blob"

    # ---- upload ----
    UPLOAD_MAX_BYTES: int = 10485760
    UPLOAD_MAX_FILE_SIZE: str = "10MB"
    UPLOAD_MAX_REQUEST_SIZE: str = "12MB"
    UPLOAD_ALLOWED_CONTENT_TYPES: str = "application/pdf,image/png,image/jpeg"

    @property
    def upload_allowed_content_types_list(self) -> list[str]:
        return [c.strip() for c in self.UPLOAD_ALLOWED_CONTENT_TYPES.split(",") if c.strip()]

    # ---- ocr ----
    OCR_PROVIDER: str = "tesseract"
    TESSDATA_PREFIX: str = ""

    # ---- carbon ----
    CARBON_ELECTRICITY_FACTOR: float = 0.45

    # ---- ai ----
    # NOTE: Java defaults AI_PROVIDER to "gemini". This Python pass only ships a
    # dev-safe canned provider (Gemini is stubbed), so the default here is
    # "canned" for now — flip to "gemini" once app/ai/gemini.py is implemented.
    AI_PROVIDER: str = "canned"
    AI_DEFAULT_MODEL: str = "gemini-2.5-pro"
    AI_FAST_MODEL: str = "gemini-2.0-flash"
    AI_TIMEOUT: int = 30
    AI_FALLBACK: bool = True
    GCP_LOCATION: str = "us-central1"

    # ---- logging ----
    LOG_LEVEL: str = "INFO"
    LOG_LEVEL_APP: str = "DEBUG"

    @model_validator(mode="after")
    def _refuse_dev_jwt_secret_in_cloud(self) -> "Settings":
        # The default is public on GitHub; Cloud Run sets K_SERVICE.
        if self.JWT_SECRET == DEV_DEFAULT_JWT_SECRET and os.environ.get("K_SERVICE"):
            raise ValueError("JWT_SECRET is unset: refusing to start with the public dev default")
        return self

    # ---- flyway (unused by alembic directly, kept for parity/reference) ----
    FLYWAY_LOCATIONS: str = "filesystem:../database/migrations"

    # ---- test-only ----
    TEST_DATABASE_URL: str = ""


settings = Settings()
