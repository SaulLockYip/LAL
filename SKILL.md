# LAL CLI Skill Documentation

This document describes the available CLI commands and common workflows for the LAL (Learn Any Language) project.

## Command Overview

The `lal-cli` tool provides commands for managing:

- **Servers**: Initialize, start, stop, and restart the application
- **AI Models**: Configure AI providers (Anthropic, OpenAI)
- **User**: Set up and view user profile
- **Articles**: Add, list, and delete learning articles

## Command Reference

### Server Management

#### `lal-cli init`

Initialize the LAL project. Sets up the database, checks directories, and creates environment configuration.

```bash
lal-cli init
```

**What it does:**
1. Creates database directory at `~/.learn-any-language/`
2. Initializes SQLite database with all tables
3. Verifies frontend and backend directories exist
4. Creates `backend/.env` with default configuration

**Output:**
```
Initializing LAL project...

[1/4] Setting up database...
  Database directory: ~/.learn-any-language
  Database file: ~/.learn-any-language/database.sqlite
  Database tables created successfully.

[2/4] Checking backend directory...
  Backend found at: /path/to/backend

[3/4] Checking frontend directory...
  Frontend found at: /path/to/frontend

[4/4] Setting up backend environment...
  Created .env file at: /path/to/backend/.env

Initialization complete!
```

---

#### `lal-cli start`

Start both frontend and backend servers.

```bash
lal-cli start
```

**Servers:**
- Backend API: http://localhost:18080
- Frontend: http://localhost:5173

**Behavior:**
- Checks if servers are already running before starting
- Waits for servers to be ready (up to 30 seconds)
- Runs servers in background until interrupted
- Press `Ctrl+C` to stop

**Error handling:**
- If ports are already in use, displays error with instructions to use `lal-cli stop` first

---

#### `lal-cli stop`

Stop all running LAL servers.

```bash
lal-cli stop
```

**Behavior:**
- Kills processes on ports 18080 (backend) and 5173 (frontend)
- Reports which servers were stopped

---

#### `lal-cli restart`

Restart all servers (stop + start).

```bash
lal-cli restart
```

---

### AI Model Management

#### `lal-cli models add anthropic`

Add an Anthropic AI model configuration.

```bash
lal-cli models add anthropic --model-name <name> --key <api-key>
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--model-name` | Yes | Model identifier (e.g., `claude-3-5-sonnet`) |
| `--key` | Yes | Anthropic API key |
| `--base-url` | No | Custom API base URL |

**Example:**
```bash
lal-cli models add anthropic \
  --model-name "claude-3-5-sonnet" \
  --key "sk-ant-api03-..."
```

---

#### `lal-cli models add openai`

Add an OpenAI AI model configuration.

```bash
lal-cli models add openai --model-name <name> --key <api-key>
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--model-name` | Yes | Model identifier (e.g., `gpt-4o`, `gpt-4`) |
| `--key` | Yes | OpenAI API key |
| `--base-url` | No | Custom API base URL (for Azure or proxies) |

**Example:**
```bash
lal-cli models add openai \
  --model-name "gpt-4o" \
  --key "sk-..."
```

---

#### `lal-cli models list`

List all configured AI models.

```bash
lal-cli models list
```

**Output format:**
```
Name                 Provider     Model                Base URL
--------------------------------------------------------------------------------
anthropic           anthropic    claude-3-5-sonnet    N/A
openai               openai       gpt-4o              N/A
```

---

#### `lal-cli models delete`

Delete an AI model configuration.

```bash
lal-cli models delete <name>
```

**Example:**
```bash
lal-cli models delete anthropic
```

**Error:** If model name does not exist, displays error message.

---

### User Management

#### `lal-cli user config`

Configure user profile settings.

```bash
lal-cli user config --name <name> --native <lang> --target <lang> --current-level <level>
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--name` | Yes | User's display name |
| `--native` | Yes | Native language |
| `--target` | Yes | Target language to learn |
| `--current-level` | No | CEFR level (default: A1) |

**Valid CEFR levels:** A1, A2, B1, B2, C1, C2

**Example:**
```bash
lal-cli user config \
  --name "John" \
  --native "English" \
  --target "German" \
  --current-level "B1"
```

---

#### `lal-cli user show`

Display current user configuration.

```bash
lal-cli user show
```

**Output:**
```
Current User Settings:
  Name:             John
  Native Language:  English
  Target Language:  German
  Current Level:    B1
```

---

### Article Management

#### `lal-cli articles add`

Add a new article for learning.

```bash
lal-cli articles add --title <title> --content <content> [options]
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--title` | Yes | Article title |
| `--content` | Yes | Article content (plain text) |
| `--source` | No | Source URL |
| `--level` | No | CEFR level (A1-C2) |
| `--notes` | No | Personal notes |

**Example:**
```bash
lal-cli articles add \
  --title "Der Wetterbericht" \
  --source "https://example.com/german-weather" \
  --content "Das Wetter heute ist schon..." \
  --level "A2" \
  --notes "Weather vocabulary"
```

**Notes:**
- Article content is base64 encoded for storage
- A UUID is generated for each article

---

#### `lal-cli articles list`

List all articles.

```bash
lal-cli articles list [flags]
```

**Flags:**
| Flag | Description |
|------|-------------|
| `--archived` | Show archived articles instead of active |

**Output:**
```
ID                                     Title                        Level  Created At
------------------------------------------------------------------------------------------------------
abc123...                              Der Wetterbericht           A2     2026-03-26 10:00
def456...                              Ein Tag in Berlin            B1     2026-03-25 15:30
```

---

#### `lal-cli articles delete`

Delete an article by ID.

```bash
lal-cli articles delete <article-id>
```

**Example:**
```bash
lal-cli articles delete abc123...
```

**Note:** This permanently deletes the article and cannot be undone.

---

## Common Workflows

### First-Time Setup

```bash
# 1. Initialize the project
lal-cli init

# 2. Configure your AI model
lal-cli models add anthropic --model-name "claude-3-5-sonnet" --key "your-key"

# 3. Set up your profile
lal-cli user config --name "Your Name" --native "English" --target "German" --current-level "A2"

# 4. Start the servers
lal-cli start
```

### Adding a New Article

```bash
# Add an article with level
lal-cli articles add \
  --title "Mein erster Tag" \
  --content "Heute ist mein erster Tag in der neuen Schule..." \
  --level "A1" \
  --source "https://example.com/article"

# Verify it was added
lal-cli articles list
```

### Managing Multiple AI Models

```bash
# Add both providers
lal-cli models add anthropic --model-name "claude-3-5-sonnet" --key "key1"
lal-cli models add openai --model-name "gpt-4o" --key "key2"

# List to see configuration
lal-cli models list

# Switch by deleting one and using the other
lal-cli models delete anthropic
```

### Switching Languages

```bash
# Update target language and level
lal-cli user config \
  --name "Your Name" \
  --native "English" \
  --target "Spanish" \
  --current-level "A1"
```

---

## Error Handling

### Port Already in Use

```
Error: Backend server is already running on port 18080.
Use 'lal-cli stop' to stop it first, or 'lal-cli restart' to restart.
```

**Solution:** Run `lal-cli stop` before starting again.

### Invalid CEFR Level

```
Error: Invalid level. Must be one of: A1, A2, B1, B2, C1, C2
```

**Solution:** Use a valid CEFR level value.

### Model Already Exists

```
Error: Model 'anthropic' already exists
```

**Solution:** Delete the existing model first with `lal-cli models delete anthropic`.

### Article Not Found

```
Error: Article with ID 'xyz' not found.
```

**Solution:** Verify the article ID using `lal-cli articles list`.

---

## Project Conventions

### Database Location
- SQLite database: `~/.learn-any-language/database.sqlite`
- Sessions: `~/.learn-any-language/sessions/{article_id}/`

### Server Ports
- Backend API: `18080`
- Frontend Dev: `5173`

### Article Levels
CEFR levels are used for difficulty classification:
- **A1**: Beginner
- **A2**: Elementary
- **B1**: Intermediate
- **B2**: Upper Intermediate
- **C1**: Advanced
- **C2**: Proficient

### Database Tables

| Table | Purpose |
|-------|---------|
| `user` | Single user profile |
| `models` | AI model configurations |
| `articles` | Learning articles |
| `word_list` | Saved vocabulary |
| `exercises` | Generated exercises |

---

## File Locations

| Component | Path |
|-----------|------|
| CLI Entry | `/cli/lal_cli/main.py` |
| CLI Libraries | `/cli/lal_cli/` |
| Backend | `/backend/` |
| Frontend | `/frontend/` |
| Database | `~/.learn-any-language/database.sqlite` |
| Sessions | `~/.learn-any-language/sessions/` |
