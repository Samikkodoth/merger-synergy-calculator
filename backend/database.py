# database.py
# Everything to do with saving and loading deals in PostgreSQL.

import os

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

# Read the secret settings from the .env file
load_dotenv()
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


def save_deal(name, inputs, results):
    with get_connection() as conn:
        return conn.execute(
            """
            INSERT INTO deals (name, inputs, results)
            VALUES (%s, %s, %s)
            RETURNING id, name, created_at
            """,
            (name, Jsonb(inputs), Jsonb(results)),
        ).fetchone()


def list_deals():
    with get_connection() as conn:
        return conn.execute(
            "SELECT id, name, created_at FROM deals ORDER BY created_at DESC"
        ).fetchall()


def get_deal(deal_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT id, name, inputs, results, created_at FROM deals WHERE id = %s",
            (deal_id,),
        ).fetchone()


def delete_deal(deal_id):
    with get_connection() as conn:
        result = conn.execute("DELETE FROM deals WHERE id = %s", (deal_id,))
        return result.rowcount > 0