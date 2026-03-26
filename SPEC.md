# LAL - Learn Any Language

## Project Overview
- **Name**: Learn Any Language (LAL)
- **Version**: 0.1.0
- **Type**: Single-user Web Application
- **Core Feature**: Article-based intensive reading with AI-powered word lookup and exercise generation
- **Target Users**: Any language learner

## Tech Stack

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- React Router 6
- Zustand (state management)
- Vite (build tool)

### Backend
- Express 4
- Prisma ORM + SQLite
- TypeScript

### CLI Tool
- Python (managed by uv)
- Purpose: Content management, AI configuration, user setup

### Database
- SQLite
- Location: `~/.learn-any-language/database.sqlite`

## Directory Structure

```
LAL_V0.1.0/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── articles.ts
│   │   │   ├── words.ts
│   │   │   ├── exercises.ts
│   │   │   └── settings.ts
│   │   ├── services/
│   │   │   └── ai.ts
│   │   └── middleware/
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── cli/
│   ├── lal_cli/
│   │   ├── __init__.py
│   │   └── main.py
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
├── SPEC.md
└── README.md
```

## UI/UX

### Theme
- Minimalist, card-based design
- Frosted glass effect
- Dark / Light mode support

### Navigation Structure
1. **Articles** - Article list and reading
2. **Word List** - Saved words management
3. **Exercises** - Exercise records
4. **Settings** - User preferences and AI configuration

### Reading Page Layout
```
┌─────────────────────────────────────────────────────────┐
│  ← Back    Article Title              [Theme] [Settings] │
├────────────────────────────┬────────────────────────────┤
│                            │                            │
│    Article Reader          │    LLM Assistant            │
│    (scrollable)           │    (session-based chat)    │
│                            │                            │
│    - Click word to lookup  │    - Auto-inject context   │
│                            │                            │
├────────────────────────────┴────────────────────────────┤
│  Word Card (popup from bottom, draggable)                │
│  - Translation hidden by default, shown on click        │
│  - Derivation/Etymology: on-demand (same LLM session)    │
│  - [+ Add to Word List] button                          │
└─────────────────────────────────────────────────────────┘
```

### Word Card Fields
- Word, Part of Speech, Phonetic
- Definition (context-dependent)
- Translation (click to show)
- Example Sentence
- Inflections, Synonyms, Phrases
- Derivation (on-demand)
- Etymology (on-demand)

### Exercise Mode
- LLM Chatbox hidden during exercise
- All questions displayed at once
- Submit → AI auto-grade (100-point scale)
- Show results: score, comments, correct answers

## Data Models

### User Table
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | User name |
| native_language | TEXT | User's native language |
| target_language | TEXT | Language being learned |
| current_level | TEXT | CEFR level |

### Articles Table
| Field | Type | Description |
|-------|------|-------------|
| id | TEXT (UUID) | Primary key |
| title | TEXT | Article title |
| content | TEXT | Base64 encoded article content |
| source | TEXT | Source URL |
| notes | TEXT | User notes |
| created_at | DATETIME | Creation timestamp |
| archived | BOOLEAN | Archive status |
| level | TEXT | CEFR level |
| current_session_file_path | TEXT | LLM session file path |

### Word List Table
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| article_id | TEXT | Foreign key to articles |
| word | TEXT | The word |
| part_of_speech | TEXT | Part of speech |
| phonetic | TEXT | Phonetic transcription |
| definition | TEXT | Definition (context-dependent) |
| translation | TEXT | Translation |
| example_sentence | TEXT | Example sentence |
| field | TEXT | Subject field |
| inflections | JSON | Word inflections |
| synonyms | JSON | Synonyms array |
| phrases | JSON | Phrases array |
| derivation | JSON | Prefix/root/suffix analysis |
| etymology | JSON | Etymology data |

### Exercise Table
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| article_id | TEXT | Foreign key to articles |
| type | TEXT | "choice" or "fill_blank" |
| question_content | TEXT | Question with `<!--BOX-->` markers |
| options | JSON | Options for choice questions |
| correct_answers | JSON | Correct answers (auto-generated during grading) |
| explanation | TEXT | AI-generated explanation |
| status | TEXT | "pending", "submitted", or "graded" |
| score | INTEGER | 100-point score |
| comments | TEXT | AI feedback |

### Session Storage
- Location: `~/.learn-any-language/sessions/`
- Structure: `{article_id}/conversation.json`

## API Design

### Base URL
- Backend: `http://localhost:18080/api`
- Frontend Dev: `http://localhost:5173`

### Response Format
Success:
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Routes
- `GET/POST /api/articles`
- `GET /api/articles/:id`
- `DELETE /api/articles/:id`
- `GET/POST /api/words?articleId=xxx`
- `POST /api/exercises/generate`
- `POST /api/exercises/:id/submit`
- `GET/PUT /api/settings/user`
- `GET/PUT /api/settings/ai`

## CLI Tool

### Commands

```bash
# Models
lal-cli models add anthropic --model-name "xxx" --base-url "xxx" --key "xxx"
lal-cli models add openai --model-name "xxx" --base-url "xxx" --key "xxx"
lal-cli models list
lal-cli models delete <name>

# User
lal-cli user config --name "xxx" --native "Chinese" --target "German" --current-level "A2"
lal-cli user config show

# Articles
lal-cli articles add --title "..." --source "..." --content "..."
lal-cli articles list
lal-cli articles delete <id>
```

### AI Configuration
- Provider: OpenAI compatible or Anthropic compatible
- Settings: model name, API key, base URL
- Stored in database, managed via CLI

## AI Prompts

### Word Lookup Prompt
```markdown
【任务】查询单词释义

【单词】{target_word}
【上下文】（文章片段，±50词）
{context_paragraph}
【用户信息】
- 目标语言：{target_language}
- 母语：{native_language}
- 当前等级：{current_level}

【输出格式 - JSON】
{
  "word": "...",
  "partOfSpeech": "...",
  "phonetic": "/.../",
  "definition": "...",
  "translation": "...",
  "exampleSentence": "...",
  "inflections": {...},
  "synonyms": [...],
  "phrases": [...],
  "field": "..."
}
```

### Derivation/Etymology Prompt (Same Session)
```markdown
【任务】分析单词的词根词缀和词源

【单词】{target_word}
【目标语言】{target_language}

分析词根、前缀、后缀及词源（可选）。

【输出格式 - JSON】
{
  "derivation": {
    "prefix": "...",
    "prefixMeaning": "...",
    "root": "...",
    "rootPid": "...",
    "rootMeaning": "...",
    "suffix": "...",
    "suffixMeaning": "..."
  },
  "etymology": {
    "explanation": "...",
    "explanationTranslation": "..."
  }
}
```

### Exercise Generation Prompt
```markdown
【任务】生成IELTS阅读题型练习

【文章内容】
{article_content}

【目标单词表】
{word_list_json}

【用户信息】
- 目标语言：{target_language}
- 当前等级：{current_level}
- 母语：{native_language}

【出题要求】
1. 生成3-5道选择题和2-3道填空题（共5-8题）
2. 题型参考IELTS Academy：
   - 选择题：围绕文章主旨、细节、推断出题
   - 填空题：基于原文信息填空，或简答题
3. 难度适配用户当前等级
4. 单词表词汇适当出现在题目中

【输出格式 - JSON】
{
  "exercises": [
    {
      "type": "choice",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."]
    },
    {
      "type": "fill_blank",
      "question": "答案位置用<!--BOX-->标记"
    }
  ]
}
```

### AI Grading Prompt
```markdown
【任务】批改用户作答

【原始题目】
{questions_json}

【用户答案】
{user_answers_json}

【文章内容】
{article_content}

【单词表】
{word_list_json}

【用户信息】
- 目标语言：{target_language}
- 母语：{native_language}
- 当前等级：{current_level}

【输出格式 - JSON】
{
  "totalScore": 85,
  "results": [
    {
      "questionIndex": 0,
      "correct": true,
      "userAnswer": "...",
      "score": 20,
      "comment": "..."
    }
  ],
  "overallComment": "..."
}
```

## Error Handling

### Retry Strategy
- Word Lookup: 10 retries, 3 second gap
- Exercise Generation: 10 retries, 3 second gap
- Grading: sync wait (no retry needed)

### Error Display
- Show error message to user
- Provide retry button

## Features Summary

### v0.1.0 Scope
1. **Article Reading**
   - View articles with word lookup
   - Word Card: instant display (pos, phonetic, def, translation hidden by default, examples, inflections, synonyms, phrases)
   - Derivation/Etymology: on-demand (same LLM session)
   - Articles list: filter, search, sort

2. **LLM Chat**
   - Embedded in reading page
   - Auto-inject: article content, user info, word list
   - Session persistence (file-based, `~/.learn-any-language/sessions/{article_id}/conversation.json`)

3. **Word List**
   - Save looked-up words
   - Each lookup creates new record (context-aware)
   - List: filter by article, search, sort

4. **Exercise**
   - AI-generated based on article + word list (IELTS-style)
   - Types: choice (选择题), fill_blank (填空题)
   - Auto grading via LLM (100-point scale)
   - Status tracking: pending → submitted → graded
   - Exercise list: filter by article/status, sort by time/score

5. **Settings**
   - User profile (name, native/target language, level)
   - AI configuration (provider, model, API key, base URL)
   - Theme toggle (light/dark)

## Build Commands

### Frontend
```bash
npm run build  # Vite build to backend/public
```

### Backend
```bash
npx ts-node src/index.ts  # Development
npx tsc && node dist/index.js  # Production
```

### Database
```bash
npx prisma migrate dev  # Create migration
npx prisma generate     # Generate client
```
