"""AI Models commands for LAL CLI."""
import sqlite3
from typing import List, Optional

from lal_cli.database import get_db


def add_anthropic(
    name: str,
    model_name: str,
    base_url: Optional[str],
    api_key: str,
) -> None:
    """Add an Anthropic AI model configuration.

    Args:
        name: Configuration name
        model_name: Model name (e.g., claude-3-5-sonnet)
        base_url: Optional base URL for API
        api_key: API key for authentication
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO models (name, provider, model_name, base_url, api_key)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, "anthropic", model_name, base_url, api_key),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"Model '{name}' already exists")


def add_openai(
    name: str,
    model_name: str,
    base_url: Optional[str],
    api_key: str,
) -> None:
    """Add an OpenAI AI model configuration.

    Args:
        name: Configuration name
        model_name: Model name (e.g., gpt-4, gpt-4o)
        base_url: Optional base URL for API
        api_key: API key for authentication
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO models (name, provider, model_name, base_url, api_key)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, "openai", model_name, base_url, api_key),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"Model '{name}' already exists")


def list_models() -> List[sqlite3.Row]:
    """List all configured AI models.

    Returns:
        List of model records
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, provider, model_name, base_url FROM models")
        return cursor.fetchall()


def delete_model(name: str) -> bool:
    """Delete an AI model configuration.

    Args:
        name: Name of the model to delete

    Returns:
        True if deleted, False if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM models WHERE name = ?", (name,))
        if not cursor.fetchone():
            return False
        cursor.execute("DELETE FROM models WHERE name = ?", (name,))
        conn.commit()
        return True
