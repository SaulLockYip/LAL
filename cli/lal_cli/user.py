"""User commands for LAL CLI."""
import sqlite3
from typing import Optional

from lal_cli.database import get_db


def set_user_config(
    name: str,
    native: str,
    target: str,
    current_level: str,
) -> None:
    """Set or update user configuration.

    Args:
        name: User's name
        native: Native language
        target: Target language to learn
        current_level: CEFR level (A1-C2)
    """
    valid_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
    if current_level.upper() not in valid_levels:
        raise ValueError(f"Invalid level. Must be one of: {', '.join(valid_levels)}")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user LIMIT 1")
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE user
                SET name = ?, nativeLanguage = ?, targetLanguage = ?, currentLevel = ?
                WHERE id = ?
                """,
                (name, native, target, current_level.upper(), existing["id"]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO user (name, nativeLanguage, targetLanguage, currentLevel)
                VALUES (?, ?, ?, ?)
                """,
                (name, native, target, current_level.upper()),
            )
        conn.commit()


def show_user_config() -> Optional[sqlite3.Row]:
    """Show current user configuration.

    Returns:
        User record or None if not configured
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user LIMIT 1")
        return cursor.fetchone()
