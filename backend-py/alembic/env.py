"""Alembic environment — runs migrations SYNCHRONOUSLY (psycopg2/plain
postgresql:// DSN) even though the app runtime uses asyncpg; only the app
needs async. DB_URL is read from the environment (same var as the Java
backend's DB_URL / application.yml), with the jdbc:postgresql:// prefix
translated to a plain postgresql:// DSN.
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import models as auth_models  # noqa: F401  (ensures models are registered on Base.metadata)
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_dsn() -> str:
    raw = os.environ.get("DB_URL", "jdbc:postgresql://localhost:5432/ecotrack")
    user = os.environ.get("DB_USER", "ecotrack")
    password = os.environ.get("DB_PASSWORD", "ecotrack")

    url = raw
    url = url.removeprefix("jdbc:")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if "@" not in url and url.startswith("postgresql://"):
        rest = url[len("postgresql://"):]
        url = f"postgresql://{user}:{password}@{rest}"
    return url


def run_migrations_offline() -> None:
    url = _sync_dsn()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _sync_dsn()
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
