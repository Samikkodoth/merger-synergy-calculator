# database.py
# Everything to do with saving and loading deals in PostgreSQL.

import os

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

# Read the secret settings from the .env file next to this one
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def create_table():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS deals (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                inputs JSONB NOT NULL,
                results JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        # Added for model version 2. Existing deals get version 1 and USD.
        conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS model_version INTEGER NOT NULL DEFAULT 1")
        conn.execute("ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'")
        # Added for company lookups (Phase 2): processed SEC data and share prices
        conn.execute("""
            CREATE TABLE IF NOT EXISTS data_cache (
                key TEXT PRIMARY KEY,
                payload JSONB NOT NULL,
                fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)


def save_deal(name, inputs, results, model_version=2, currency="USD"):
    with get_connection() as conn:
        return conn.execute(
            """
            INSERT INTO deals (name, inputs, results, model_version, currency)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, created_at
            """,
            (name, Jsonb(inputs), Jsonb(results), model_version, currency),
        ).fetchone()


def list_deals():
    with get_connection() as conn:
        return conn.execute(
            "SELECT id, name, currency, created_at FROM deals ORDER BY created_at DESC"
        ).fetchall()


def get_deal(deal_id):
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT id, name, inputs, results, model_version, currency, created_at
            FROM deals WHERE id = %s
            """,
            (deal_id,),
        ).fetchone()


def delete_deal(deal_id):
    with get_connection() as conn:
        result = conn.execute("DELETE FROM deals WHERE id = %s", (deal_id,))
        return result.rowcount > 0


# ------------------------------------------------------------ Cache for company lookups

def cache_get(key):
    with get_connection() as conn:
        return conn.execute("SELECT payload, fetched_at FROM data_cache WHERE key = %s", (key,)).fetchone()


def cache_put(key, payload):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_cache (key, payload, fetched_at) VALUES (%s, %s, NOW())
            ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()
            """,
            (key, Jsonb(payload)),
        )
        # Price entries are keyed by day, so old ones are never read again
        conn.execute("DELETE FROM data_cache WHERE key LIKE 'price:%' AND fetched_at < NOW() - INTERVAL '7 days'")
