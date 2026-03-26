"""Articles commands for LAL CLI."""
import base64
import sqlite3
import uuid
from typing import List, Optional, Tuple

from lal_cli.database import get_db


def add_article(
    title: str,
    source: Optional[str],
    content: str,
    level: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Add a new article.

    Args:
        title: Article title
        source: Source URL
        content: Article content (will be base64 encoded)
        level: CEFR level (A1-C2)
        notes: User notes

    Returns:
        Article ID
    """
    article_id = str(uuid.uuid4())
    encoded_content = base64.b64encode(content.encode()).decode()

    # Default values
    level = level or ""
    notes = notes or ""
    source = source or ""

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO articles (id, title, content, source, notes, level)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (article_id, title, encoded_content, source, notes, level),
        )
        conn.commit()

    return article_id


def list_articles(archived: bool = False) -> List[sqlite3.Row]:
    """List all articles.

    Args:
        archived: If True, show archived articles

    Returns:
        List of article records
    """
    with get_db() as conn:
        cursor = conn.cursor()
        if archived:
            cursor.execute(
                "SELECT id, title, source, level, createdAt FROM articles WHERE archived = 1 ORDER BY createdAt DESC"
            )
        else:
            cursor.execute(
                "SELECT id, title, source, level, createdAt FROM articles WHERE archived = 0 ORDER BY createdAt DESC"
            )
        return cursor.fetchall()


def get_article(article_id: str) -> Optional[sqlite3.Row]:
    """Get an article by ID.

    Args:
        article_id: Article ID

    Returns:
        Article record or None if not found
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
        return cursor.fetchone()


def delete_article(article_id: str) -> Tuple[bool, str]:
    """Delete an article by ID.

    Args:
        article_id: Article ID

    Returns:
        Tuple of (success, title)
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title FROM articles WHERE id = ?", (article_id,))
        row = cursor.fetchone()

        if not row:
            return (False, "")

        cursor.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        conn.commit()
        return (True, row["title"])
