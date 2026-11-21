#!/usr/bin/env python3
"""One-time import of legacy SKYSCRAPER SQLite accounts into Render PostgreSQL."""
import argparse
from app.cloud_common import init_db, migrate_sqlite_users

parser = argparse.ArgumentParser()
parser.add_argument("sqlite_path", help="Path to the existing skyscraper.db file")
args = parser.parse_args()
init_db()
print(migrate_sqlite_users(args.sqlite_path))
