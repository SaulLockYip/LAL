-- LAL Database Schema
-- SQLite database at ~/.learn-any-language/database.sqlite

-- User table
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    native_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    current_level TEXT NOT NULL DEFAULT 'A1'
);

-- AI Models table
CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    base_url TEXT,
    api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived INTEGER DEFAULT 0,
    level TEXT,
    current_session_file_path TEXT
);

-- Word List table
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
);

-- Exercise table
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
);
