# LAL - Learn Any Language

A language learning web application with AI-powered features for vocabulary lookup, reading comprehension, and exercise generation.

## Project Overview

LAL (Learn Any Language) is a single-user web application designed for language learners who want to improve their reading comprehension through intensive reading of authentic materials. The app provides AI-powered word lookup, an embedded AI chat assistant, and auto-generated exercises based on article content.

## Architecture Overview

```
LAL_V0.1.0/
├── backend/           # Express + Prisma + SQLite API server
├── frontend/          # React + Tailwind + TypeScript web app
└── cli/               # Python CLI tool for content management
```

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS 4.0
- **State Management**: Zustand
- **Routing**: React Router 6
- **Build Tool**: Vite 6.0
- **Port**: 5173 (development)

### Backend
- **Framework**: Express 4
- **ORM**: Prisma 6.6
- **Database**: SQLite
- **Language**: TypeScript
- **Port**: 18080

### CLI Tool
- **Language**: Python 3.10+
- **Package Manager**: uv
- **CLI Framework**: Click 8

## Features

### Article Reading
- View articles with click-to-lookup word definitions
- Word Card displays: part of speech, phonetic, definition, translation (hidden by default), examples
- Derivation and Etymology analysis on-demand via AI

### AI Chat Assistant (ChatBox)
- Floating chat panel with inline embedding in article reading
- Session persistence across conversations with ChatHistory
- Context-aware AI with ChatContextPicker (Article, Word List, Exercises, Global)
- Real-time streaming responses with SSE
- Supports both Anthropic Claude and OpenAI GPT models
- Keyboard shortcuts: Ctrl+Enter to send, ↑ to edit last message
- Per-conversation regeneration support

### Word List
- Save words from article reading with one-click lookup
- Word Card displays: part of speech, phonetic, definition, translation, examples
- Derivation and Etymology analysis on-demand via AI
- Close button during AI lookup loading (prevents blocking)

### Exercises
- AI-generated IELTS-style exercises based on articles and word lists
- Support for multiple choice and fill-in-the-blank questions
- Auto-grading with 100-point scale scoring
- Per-question detailed analysis (逐题解析)
- Real-time progress visualization during generation and grading

### Text-to-Speech (TTS)
- Full article reading with Web Speech API pronunciation
- Per-sentence audio playback with visual highlighting
- TTS history management with hard delete functionality
- Speaker voice selection support

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm or yarn

### Installation

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install CLI via uv (recommended):**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/SaulLockYip/LAL/main/install.sh | bash
   ```

   This will clone the repo, install the CLI, and initialize the project.

   Or manually:
   ```bash
   git clone https://github.com/SaulLockYip/LAL.git
   cd LAL/cli
   uv tool install .
   cd ..
   lal-cli init
   ```

### Initialize the Project

```bash
lal-cli init
```

This will:
- Create the database at `~/.learn-any-language/database.sqlite`
- Create the backend `.env` file with default configuration
- Verify frontend and backend directories exist

### Start the Server

```bash
lal-cli start
```

The server starts on **http://localhost:18080** and serves:
- Frontend (static files)
- Backend API at `/api/*`

### Configure AI Model

```bash
# Add Anthropic Claude model
lal-cli models add anthropic --model-name "claude-3-5-sonnet" --key "your-api-key"

# Add OpenAI model
lal-cli models add openai --model-name "gpt-4o" --key "your-api-key"
```

### Configure User Profile

```bash
lal-cli user config --name "Your Name" --native "English" --target "German" --current-level "A2"
```

## CLI Commands

### Server Management

| Command | Description |
|---------|-------------|
| `lal-cli init` | Clone repo, install deps, build frontend, setup database |
| `lal-cli start` | Start the server (serves frontend + API) |
| `lal-cli stop` | Stop the server |
| `lal-cli restart` | Restart the server |
| `lal-cli update` | Update to latest version (git pull + reinstall + rebuild) |

### AI Model Management

```bash
# Add Anthropic model
lal-cli models add anthropic --model-name "claude-3-5-sonnet" --key "your-key"

# Add OpenAI model
lal-cli models add openai --model-name "gpt-4o" --key "your-key"

# List all models
lal-cli models list

# Delete a model
lal-cli models delete <name>
```

### Settings Management

```bash
# Show all settings (user, AI, voices)
lal-cli settings show

# List available TTS voices
lal-cli settings voices

# Test AI configuration
lal-cli settings ai-test
```

### User Management

```bash
# Configure user profile
lal-cli user config --name "Name" --native "NativeLang" --target "TargetLang" --current-level "B1"

# Show current settings
lal-cli user show
```

### Article Management

```bash
# Add an article
lal-cli articles add --title "Article Title" --content "Article content here..." --level "B1"

# Add with source URL and notes
lal-cli articles add --title "Title" --source "https://example.com" --content "Content" --notes "My notes"

# Get a single article by ID
lal-cli articles get <article-id>

# List all articles
lal-cli articles list

# List archived articles
lal-cli articles list --archived

# Delete an article
lal-cli articles delete <article-id>
```

## Environment Variables

### Backend (.env)

Located at `backend/.env`:

```env
# Database
DATABASE_URL="file:~/.learn-any-language/database.sqlite"

# Server
PORT=18080
```

### Database Location

SQLite database: `~/.learn-any-language/database.sqlite`

Session storage: `~/.learn-any-language/sessions/{article_id}/conversation.json`

## Tech Stack Details

### Frontend Dependencies
- `react` / `react-dom` - UI framework
- `react-router-dom` - Client-side routing
- `zustand` - State management
- `tailwindcss` - CSS framework
- `@tailwindcss/vite` - Tailwind Vite plugin
- `lucide-react` - Icon library
- `react-markdown` - Markdown rendering

### Backend Dependencies
- `express` - Web framework
- `@prisma/client` - Database ORM
- `prisma` - ORM CLI and schema management
- `cors` - Cross-origin resource sharing
- `tsx` - TypeScript execution

### CLI Dependencies
- `click` - CLI framework
- `requests` - HTTP library (for future API integrations)

## Data Models

### User
| Field | Type | Description |
|-------|------|-------------|
| name | TEXT | User's name |
| native_language | TEXT | Native language |
| target_language | TEXT | Language being learned |
| current_level | TEXT | CEFR level (A1-C2) |

### Articles
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Primary key |
| title | TEXT | Article title |
| content | TEXT | Article content (CLI auto-encodes to base64) |
| source | TEXT | Source URL |
| level | TEXT | CEFR level |
| archived | BOOLEAN | Archive status |

### Word List
| Field | Type | Description |
|-------|------|-------------|
| word | TEXT | The word |
| part_of_speech | TEXT | POS tag |
| phonetic | TEXT | Phonetic transcription |
| definition | TEXT | Context-dependent definition |
| translation | TEXT | Translation to native language |

### Exercise
| Field | Type | Description |
|-------|------|-------------|
| type | TEXT | "choice" or "fill_blank" |
| status | TEXT | "pending", "submitted", "graded" |
| score | INTEGER | 100-point score |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/articles` | List or create articles |
| GET | `/api/articles/:id` | Get single article |
| DELETE | `/api/articles/:id` | Delete article |
| GET/POST | `/api/words` | List or create words |
| POST | `/api/exercises/generate` | Generate exercises |
| POST | `/api/exercises/:id/submit` | Submit and grade |
| GET/PUT | `/api/settings/user` | User settings |
| GET/PUT | `/api/settings/ai` | AI configuration |
| GET/POST | `/api/chat` | List/create conversations |
| GET/POST | `/api/chat/:id` | Get conversation with messages |
| DELETE | `/api/chat/:id` | Delete conversation |
| POST | `/api/chat/stream` | Streaming chat with AI |
| GET | `/api/settings/tts-voices` | List TTS voices |
