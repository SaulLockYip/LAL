# LAL CLI Skill Documentation

This document describes the available CLI commands and common workflows for the LAL (Learn Any Language) project.

## Command Overview

The `lal-cli` tool provides commands for managing:

- **Servers**: Initialize, start, stop, and restart the application
- **AI Models**: Configure AI providers (Anthropic, OpenAI)
- **User**: Set up and view user profile
- **Articles**: Add, list, get, and delete learning articles
- **Settings**: View settings, TTS voices, and test AI configuration

## Command Reference

### Server Management

#### `lal-cli init`

Initialize the LAL project. Clones the repository, installs dependencies, builds the frontend, and sets up the database.

```bash
lal-cli init
```

**What it does:**
1. Clones repository to `~/LAL` (or specified directory)
2. Installs npm dependencies for backend and frontend
3. Builds frontend static files
4. Creates database directory at `~/.learn-any-language/`
5. Initializes SQLite database with all tables
6. Creates `backend/.env` with default configuration

**Options:**
- `--repo <url>` - Git repository URL (default: https://github.com/SaulLockYip/LAL.git)
- `--dir <path>` - Target directory (default: ~/LAL)
- `--skip-clone` - Skip cloning, use existing directory

**Output:**
```
Initializing LAL project...

[1/6] Setting up project directory...
  Cloning repository to: ~/LAL

[2/6] Installing backend dependencies...
[3/6] Installing frontend dependencies...
[4/6] Building frontend...
[5/6] Setting up database...
[6/6] Setting up backend environment...

Initialization complete!
```

---

#### `lal-cli start`

Start the LAL server (serves both frontend static files and API).

```bash
lal-cli start
```

**Server:**
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

Restart the server (stop + start).

```bash
lal-cli restart
```

---

#### `lal-cli update`

Update LAL to the latest version from git, then reinstall dependencies and rebuild.

```bash
lal-cli update
```

**What it does:**
1. Stops the server if running
2. Pulls latest code from git
3. Reinstalls backend dependencies
4. Reinstalls frontend dependencies
5. Rebuilds frontend static files
6. Restarts the server

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

### Settings Management

#### `lal-cli settings show`

Display all current settings including user profile, AI configuration, and available TTS voices.

```bash
lal-cli settings show
```

**Output:**
```
User Settings:
  Name:             John
  Native Language:  English
  Target Language:  German
  Current Level:    B1

AI Settings:
  Provider:         anthropic
  Model:            claude-3-5-sonnet
  Base URL:         N/A

TTS Voices:
  en-US:           Microsoft David (en-US)
  de-DE:           Microsoft Katja (de-DE)
  ...
```

---

#### `lal-cli settings voices`

List all available TTS voices for text-to-speech.

```bash
lal-cli settings voices
```

---

#### `lal-cli settings ai-test`

Test the configured AI model by sending a simple request.

```bash
lal-cli settings ai-test
```

**Output:**
```
Testing AI configuration...
Provider: anthropic
Model: claude-3-5-sonnet
AI Response: Hello! I'm ready to help you learn.
```

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
- Pass article content as plain text - the CLI handles base64 encoding automatically
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

#### `lal-cli articles get`

Get a single article by ID.

```bash
lal-cli articles get <article-id>
```

**Example:**
```bash
lal-cli articles get abc123...
```

**Output:**
```
ID:          abc123...
Title:       Der Wetterbericht
Level:       A2
Source:      https://example.com/article
Created:     2026-03-26 10:00
Archived:    No

Content:
Das Wetter heute ist schon gut...
```

## Common Workflows

### First-Time Setup

```bash
# Install CLI (clones repo, installs CLI, initializes project)
curl -fsSL https://raw.githubusercontent.com/SaulLockYip/LAL/main/install.sh | bash

# Configure your AI model
lal-cli models add anthropic --model-name "claude-3-5-sonnet" --key "your-key"

# Set up your profile
lal-cli user config --name "Your Name" --native "English" --target "German" --current-level "A2"

# Start the server (serves both frontend and API)
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
| `conversations` | Chat conversations |
| `messages` | Chat messages |

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
