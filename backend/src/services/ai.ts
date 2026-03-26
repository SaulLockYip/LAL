import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  baseUrl: string;
  streaming?: boolean;
}

export interface WordLookupResult {
  word: string;
  partOfSpeech: string;
  phonetic: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  inflections: Record<string, unknown>;
  synonyms: string[];
  phrases: string[];
  field: string;
}

export interface DerivationEtymologyResult {
  derivation: {
    prefix: string;
    prefixMeaning: string;
    root: string;
    rootPid: string;
    rootMeaning: string;
    suffix: string;
    suffixMeaning: string;
  };
  etymology: {
    explanation: string;
    explanationTranslation: string;
  };
}

export interface ExerciseResult {
  type: 'choice' | 'fill_blank';
  question: string;
  options?: string[];
}

export interface GradingResult {
  totalScore: number;
  results: Array<{
    questionIndex: number;
    correct: boolean;
    userAnswer: string;
    score: number;
    comment: string;
  }>;
  overallComment: string;
}

// Convert messages to OpenAI format
function toOpenAIMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

// Convert messages to Anthropic format
function toAnthropicMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : m.role, content: m.content }));
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function chatWithRetry(
  messages: ChatMessage[],
  options: ChatOptions,
  retries = 10,
  delayMs = 3000
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await chat(messages, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError || new Error('AI chat failed after retries');
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions
): Promise<string> {
  const { provider, model, apiKey, baseUrl } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  let body: Record<string, unknown>;
  let endpoint: string;

  if (provider === 'openai') {
    endpoint = `${baseUrl}/chat/completions`;
    body = {
      model,
      messages: toOpenAIMessages(messages),
      stream: false,
    };
  } else {
    // Anthropic
    endpoint = `${baseUrl}/v1/messages`;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model,
      messages: toAnthropicMessages(messages),
      max_tokens: 4096,
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  if (provider === 'openai') {
    const choices = data.choices as Array<{ message?: { content?: string } }>;
    return choices?.[0]?.message?.content || '';
  } else {
    // Anthropic returns content as array with potentially multiple types (thinking, text, etc.)
    // Find the first text type
    const content = data.content as Array<{ type?: string; text?: string }>;
    const textContent = content?.find(c => c.type === 'text');
    return textContent?.text || '';
  }
}

export async function chatStreaming(
  messages: ChatMessage[],
  options: ChatOptions,
  onChunk: (chunk: string) => void
): Promise<void> {
  const { provider, model, apiKey, baseUrl } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  let body: Record<string, unknown>;
  let endpoint: string;

  if (provider === 'openai') {
    endpoint = `${baseUrl}/chat/completions`;
    body = {
      model,
      messages: toOpenAIMessages(messages),
      stream: true,
    };
  } else {
    endpoint = `${baseUrl}/v1/messages`;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model,
      messages: toAnthropicMessages(messages),
      max_tokens: 4096,
      stream: true,
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          let chunk = '';

          if (provider === 'openai') {
            const choices = parsed.choices as Array<{ delta?: { content?: string } }>;
            chunk = choices?.[0]?.delta?.content || '';
          } else {
            const content = parsed.content as Array<{ text?: string }>;
            chunk = content?.[0]?.text || '';
          }

          if (chunk) {
            onChunk(chunk);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

// Get AI settings from database
async function getAISettings(): Promise<ChatOptions | null> {
  const setting = await prisma.aISetting.findFirst({
    where: { name: 'default' },
  });

  if (!setting) {
    return null;
  }

  return {
    provider: setting.provider as 'openai' | 'anthropic',
    model: setting.modelName,
    apiKey: setting.apiKey,
    baseUrl: setting.baseUrl,
  };
}

// Get user settings from database
async function getUserSettings() {
  const user = await prisma.user.findFirst();
  return user || null;
}

// Word Lookup
export async function lookupWord(
  word: string,
  contextParagraph: string
): Promise<WordLookupResult> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = userSettings?.targetLanguage || 'English';
  const nativeLanguage = userSettings?.nativeLanguage || 'Chinese';
  const currentLevel = userSettings?.currentLevel || 'A2';

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】查询单词释义

【单词】${word}
【上下文】（文章片段，±50词）
${contextParagraph}
【用户信息】
- 目标语言：${targetLanguage}
- 母语：${nativeLanguage}
- 当前等级：${currentLevel}

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
}`,
    },
  ];

  const response = await chatWithRetry(messages, aiSettings);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  return JSON.parse(jsonMatch[0]) as WordLookupResult;
}

// Get Derivation/Etymology (same session)
export async function getDerivationEtymology(
  word: string
): Promise<DerivationEtymologyResult> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = userSettings?.targetLanguage || 'English';

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】分析单词的词根词缀和词源

【单词】${word}
【目标语言】${targetLanguage}

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
}`,
    },
  ];

  const response = await chatWithRetry(messages, aiSettings);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  return JSON.parse(jsonMatch[0]) as DerivationEtymologyResult;
}

// Generate Exercises
export async function generateExercises(
  articleContent: string,
  wordListJson: string
): Promise<ExerciseResult[]> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = userSettings?.targetLanguage || 'English';
  const nativeLanguage = userSettings?.nativeLanguage || 'Chinese';
  const currentLevel = userSettings?.currentLevel || 'A2';

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】生成IELTS阅读题型练习

【文章内容】
${articleContent}

【目标单词表】
${wordListJson}

【用户信息】
- 目标语言：${targetLanguage}
- 当前等级：${currentLevel}
- 母语：${nativeLanguage}

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
}`,
    },
  ];

  const response = await chatWithRetry(messages, aiSettings);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const data = JSON.parse(jsonMatch[0]) as { exercises: ExerciseResult[] };
  return data.exercises;
}

// Grade Exercises
export async function gradeExercises(
  questionsJson: string,
  userAnswersJson: string,
  articleContent: string,
  wordListJson: string
): Promise<GradingResult> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = userSettings?.targetLanguage || 'English';
  const nativeLanguage = userSettings?.nativeLanguage || 'Chinese';
  const currentLevel = userSettings?.currentLevel || 'A2';

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】批改用户作答

【原始题目】
${questionsJson}

【用户答案】
${userAnswersJson}

【文章内容】
${articleContent}

【单词表】
${wordListJson}

【用户信息】
- 目标语言：${targetLanguage}
- 母语：${nativeLanguage}
- 当前等级：${currentLevel}

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
}`,
    },
  ];

  // Grading doesn't need retry per spec
  const response = await chat(messages, aiSettings);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  return JSON.parse(jsonMatch[0]) as GradingResult;
}

// Export prisma for use in routes
export { prisma };
