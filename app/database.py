
import json
import sqlite3
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).resolve().parent.parent / "nexora_verify.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                source_code TEXT NOT NULL,
                issue_count INTEGER NOT NULL,
                issues_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def save_analysis(
    filename: str,
    source_code: str,
    issues: list[dict[str, Any]],
) -> int:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO analyses (
                filename,
                source_code,
                issue_count,
                issues_json
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                filename,
                source_code,
                len(issues),
                json.dumps(issues, ensure_ascii=False),
            ),
        )
        return int(cursor.lastrowid)


def get_analysis(analysis_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, filename, issue_count, issues_json, created_at
            FROM analyses
            WHERE id = ?
            """,
            (analysis_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "filename": row["filename"],
        "issue_count": row["issue_count"],
        "issues": json.loads(row["issues_json"]),
        "created_at": row["created_at"],
    }


def get_analysis_history(limit: int = 20) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, filename, issue_count, created_at
            FROM analyses
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "filename": row["filename"],
            "issue_count": row["issue_count"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
