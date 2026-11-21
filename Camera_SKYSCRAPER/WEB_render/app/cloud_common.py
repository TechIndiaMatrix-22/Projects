"""Shared PostgreSQL authentication primitives for SKYSCRAPER cloud portals.

This module is intentionally independent of Raspberry Pi hardware services.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from argon2 import PasswordHasher, exceptions as argon2_exceptions

password_hasher = PasswordHasher()


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL is required for the SKYSCRAPER cloud portals.")
    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://"):]
    return value


def connect():
    return psycopg.connect(database_url(), row_factory=dict_row, connect_timeout=10)


def init_db() -> None:
    with connect() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                salt BYTEA,
                password_hash BYTEA NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                phone_e164 TEXT,
                role TEXT NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'admin'))
            )
        """)
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_e164 ON users(phone_e164) WHERE phone_e164 IS NOT NULL")
        con.execute("CREATE INDEX IF NOT EXISTS idx_users_role_created ON users(role, created_at)")


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)


def make_password(password: str) -> tuple[bytes, bytes]:
    salt = secrets.token_bytes(16)
    return salt, password_digest(password, salt)


def verify_and_upgrade(row: dict[str, Any], password: str) -> bool:
    salt = row.get("salt")
    stored = row["password_hash"]
    if salt is not None:
        valid = hmac.compare_digest(password_digest(password, bytes(salt)), bytes(stored))
        return valid

    # Legacy Argon2 accounts are verified, then upgraded to the current scrypt format.
    try:
        valid = password_hasher.verify(bytes(stored).decode("utf-8"), password)
    except (argon2_exceptions.VerificationError, argon2_exceptions.InvalidHashError, UnicodeDecodeError):
        valid = False
    if valid:
        new_salt, new_hash = make_password(password)
        with connect() as con:
            con.execute("UPDATE users SET salt=%s, password_hash=%s WHERE id=%s", (new_salt, new_hash, row["id"]))
    return valid


def normalize_phone_e164(country_code: str, phone: str) -> str:
    import re
    cc = re.sub(r"\D", "", country_code or "")
    number = re.sub(r"\D", "", phone or "")
    if not cc or not number:
        raise ValueError("Enter a country code and mobile number.")
    normalized = number if number.startswith(cc) else cc + number.lstrip("0")
    if not 8 <= len(normalized) <= 15:
        raise ValueError("Enter a valid international mobile number.")
    return normalized


def bootstrap_admin() -> None:
    """Create the first admin only from private Render environment variables."""
    username = os.getenv("SKYSCRAPER_ADMIN_USERNAME", "").strip()
    password = os.getenv("SKYSCRAPER_ADMIN_PASSWORD", "")
    if not username and not password:
        return
    if not username or len(password) < 16:
        raise RuntimeError("Set both SKYSCRAPER_ADMIN_USERNAME and a 16+ character SKYSCRAPER_ADMIN_PASSWORD.")
    salt, digest = make_password(password)
    with connect() as con:
        existing = con.execute("SELECT id, role FROM users WHERE username=%s", (username,)).fetchone()
        if existing is None:
            con.execute("INSERT INTO users(username,salt,password_hash,role,created_at) VALUES(%s,%s,%s,'admin',%s)",
                        (username, salt, digest, datetime.now(timezone.utc)))
        elif existing["role"] != "admin":
            raise RuntimeError("Admin bootstrap username already exists as a customer. Choose a new admin username or promote it through a controlled database migration.")


def migrate_sqlite_users(sqlite_path: str) -> dict[str, int]:
    """One-time, idempotent import of the existing CM4 SQLite users table."""
    source = Path(sqlite_path).expanduser()
    if not source.is_file():
        raise FileNotFoundError(f"SQLite database not found: {source}")
    old = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    old.row_factory = sqlite3.Row
    try:
        columns = {r["name"] for r in old.execute("PRAGMA table_info(users)")}
        required = {"username", "password_hash", "created_at"}
        if not required.issubset(columns):
            raise RuntimeError("The source SQLite users table is missing required columns.")
        imported = skipped = 0
        with connect() as new:
            for row in old.execute("SELECT * FROM users"):
                salt = row["salt"] if "salt" in columns else None
                phone = row["phone_e164"] if "phone_e164" in columns else None
                created = row["created_at"]
                try:
                    created_at = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    if created_at.tzinfo is None:
                        created_at = created_at.replace(tzinfo=timezone.utc)
                except (AttributeError, ValueError):
                    created_at = datetime.now(timezone.utc)
                cur = new.execute("""INSERT INTO users(username,salt,password_hash,created_at,phone_e164,role)
                    VALUES(%s,%s,%s,%s,%s,'customer') ON CONFLICT(username) DO NOTHING""",
                    (row["username"], salt, row["password_hash"], created_at, phone))
                if cur.rowcount:
                    imported += 1
                else:
                    skipped += 1
        return {"imported": imported, "skipped_existing": skipped}
    finally:
        old.close()
