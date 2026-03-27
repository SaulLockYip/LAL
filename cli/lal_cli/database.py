"""Database module for LAL CLI."""
import contextlib
import os
import sqlite3
from pathlib import Path
from typing import Generator, Optional

DB_PATH = Path.home() / ".learn-any-language" / "database.sqlite"


def get_db_path() -> Path:
    """Get the database path, creating the directory if needed."""
    db_dir = DB_PATH.parent
    db_dir.mkdir(parents=True, exist_ok=True)
    return DB_PATH


def get_connection() -> sqlite3.Connection:
    """Get a SQLite database connection."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


@contextlib.contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections.

    Yields:
        sqlite3.Connection: Database connection

    Example:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user")
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initialize the database with required tables."""
    conn = get_connection()
    cursor = conn.cursor()

    # User table (Prisma uses camelCase)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            nativeLanguage TEXT NOT NULL,
            targetLanguage TEXT NOT NULL,
            currentLevel TEXT NOT NULL DEFAULT 'A1',
            voice TEXT
        )
    """)

    # AI Models table (AISettings)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            model_name TEXT NOT NULL,
            base_url TEXT,
            api_key TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Articles table (Prisma uses camelCase)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT NOT NULL,
            notes TEXT NOT NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            archived BOOLEAN NOT NULL DEFAULT false,
            level TEXT NOT NULL,
            currentSessionFilePath TEXT
        )
    """)

    # Word List table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id TEXT,
            word TEXT NOT NULL,
            part_of_speech TEXT,
            phonetic TEXT,
            definition TEXT,
            translation TEXT,
            example_sentence TEXT,
            field TEXT,
            inflections TEXT,
            synonyms TEXT,
            phrases TEXT,
            derivation TEXT,
            etymology TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles(id)
        )
    """)

    # Exercise table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id TEXT,
            type TEXT NOT NULL,
            question_content TEXT NOT NULL,
            options TEXT,
            correct_answers TEXT,
            explanation TEXT,
            status TEXT DEFAULT 'pending',
            score INTEGER,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles(id)
        )
    """)

    conn.commit()
    conn.close()
