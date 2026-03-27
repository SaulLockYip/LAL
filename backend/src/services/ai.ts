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

// Exercise Types
export type ExerciseType = 'choice' | 'fill_blank' | 'open_ended' | 'translation' | 'word_explanation' | 'sentence_imitation';

// IELTS Band Descriptors for reference
export const IELTS_BANDS = {
  9: 'Expert user - Full flexibility, precise vocabulary, excellent grammar',
  8: 'Very good user - Full effectiveness, occasional inaccuracies',
  7: 'Good user - Effective command, minor errors',
  6: 'Competent user - Generally effective, but inaccurate/misaligned',
  5: 'Modest user - Partial command, moderate errors',
  4: 'Limited user - Basic competence, frequent errors',
  3: 'Extremely limited user - Can convey only general meaning',
  2: 'Intermittent user - Very limited competence',
  1: 'Non-user - No ability to use language',
  0: 'Did not attempt',
};

export interface ExerciseResult {
  type: ExerciseType;
  question: string;
  options?: string[];           // For choice questions
  correctAnswers?: string[];     // For objective questions (fill_blank, translation, choice)
  blanks?: number;              // Number of blanks for fill_blank questions
  sampleAnswer?: string;        // For open_ended questions
  rubric?: {
    bands: Record<string, { min: number; max: number; description: string }>;
    criteria: string[];
  };
  explanation?: string;
}

export interface PerQuestionAnalysis {
  isCorrect: boolean;           // Whether the answer is correct
  correctAnswer: string;        // The correct answer
  keyPoints: string[];         // Key points to understand
  explanation: string;          // Detailed explanation of why the answer is correct/incorrect
  improvementSuggestions: string[]; // Suggestions for improvement
}

export interface GradingResult {
  totalScore: number;           // 0-100
  bandScore: number;            // IELTS band 0-9
  results: Array<{
    questionIndex: number;
    exerciseId: number;
    type: ExerciseType;
    correct: boolean;
    userAnswer: string;
    expectedAnswer?: string;    // For objective questions
    score: number;              // Points earned
    maxScore: number;          // Maximum possible points
    bandScore: number;          // IELTS band for this question
    comment: string;            // Brief feedback
    analysis: PerQuestionAnalysis; // Detailed per-question analysis (逐题解析)
  }>;
  overallComment: string;
  strengths: string[];
  areasForImprovement: string[];
}

// Convert messages to OpenAI format
function toOpenAIMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

// Convert messages to Anthropic format
// Anthropic requires: system messages in separate 'system' field, messages array has only user/assistant
function toAnthropicMessages(messages: ChatMessage[]): { messages: Array<{ role: string; content: string }>; system?: string } {
  const systemMessages: string[] = [];
  const chatMessages: Array<{ role: string; content: string }> = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemMessages.push(m.content);
    } else {
      chatMessages.push({ role: m.role === 'assistant' ? 'assistant' : m.role, content: m.content });
    }
  }

  return {
    messages: chatMessages,
    system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function chatWithRetry(
  messages: ChatMessage[],
  options: ChatOptions,
  retries = 10,
  delayMs = 3000,
  timeoutMs = 180000 // 3 minute timeout per attempt
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Create a promise that races the chat call against a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([
        chat(messages, options),
        timeoutPromise
      ]);

      return result;
    } catch (error) {
      lastError = error as Error;
      // If it was a timeout, don't retry - just fail fast
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }
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
    const anthropicData = toAnthropicMessages(messages);
    body = {
      model,
      ...anthropicData,
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
    const anthropicData = toAnthropicMessages(messages);
    body = {
      model,
      ...anthropicData,
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
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      // Track Anthropic event type (e.g., "event: content_block_delta")
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

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
            // Anthropic streaming: content is in delta.text
            // Event types: content_block_delta, message_delta, etc.
            if (currentEvent === 'content_block_delta' || currentEvent === 'message_delta') {
              const delta = parsed.delta as { text?: string; type?: string };
              if (delta?.type === 'text_delta') {
                chunk = delta.text || '';
              }
            }
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

// Generate Exercises with varied question types
export async function generateExercises(
  articleContent: string,
  wordListJson: string,
  options?: {
    countPerType?: Partial<Record<ExerciseType, number>>;
    userNativeLanguage?: string;
    userTargetLanguage?: string;
    userLevel?: string;
  }
): Promise<ExerciseResult[]> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = options?.userTargetLanguage || userSettings?.targetLanguage || 'English';
  const nativeLanguage = options?.userNativeLanguage || userSettings?.nativeLanguage || 'Chinese';
  const currentLevel = options?.userLevel || userSettings?.currentLevel || 'A2';

  // Default counts for each exercise type
  const counts = {
    choice: options?.countPerType?.choice ?? 2,
    fill_blank: options?.countPerType?.fill_blank ?? 2,
    open_ended: options?.countPerType?.open_ended ?? 1,
    translation: options?.countPerType?.translation ?? 1,
    word_explanation: options?.countPerType?.word_explanation ?? 1,
    sentence_imitation: options?.countPerType?.sentence_imitation ?? 1,
  };

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】生成多样化的语言学习练习题

【文章内容】
${articleContent}

【目标单词表】
${wordListJson}

【用户信息】
- 目标语言：${targetLanguage}
- 母语：${nativeLanguage}
- 当前等级：${currentLevel}

【出题要求】
请生成以下类型的练习题（共${Object.values(counts).reduce((a, b) => a + b, 0)}题）：

1. 选择题 (${counts.choice}题)
   - 围绕文章主旨、细节、推断出题
   - 4个选项，A/B/C/D格式
   - 必须有一个正确答案和3个合理但错误的干扰项

2. 填空题 - 多空填写 (${counts.fill_blank}题)
   - 基于原文信息填空
   - 支持多空填写，每空独立计分
   - 使用<!--BLANK-->标记每个空位
   - 例如："The main character traveled to <!--BLANK--> and met <!--BLANK-->"

3. 开放式问答题 (${counts.open_ended}题)
   - 没有标准答案，需要LLM评估
   - 考察理解力、表达能力、词汇运用
   - 必须提供sampleAnswer参考

4. 翻译题 (${counts.translation}题)
   - 包含两个方向：目标语言→母语 和 母语→目标语言
   - 翻译题格式：{"direction": "to_native" | "to_target", "text": "..."}
   - 必须提供correctAnswers

5. 词语语义解释题 (${counts.word_explanation}题)
   - 解释文章中重要词汇/短语的意义
   - 要求用目标语言解释
   - 必须提供sampleAnswer

6. 句子模仿题 (${counts.sentence_imitation}题)
   - 提供一个例句，要求用户模仿其结构
   - 例句应包含有用的语法结构或表达方式
   - 必须提供sampleAnswer

【IELTS评分标准参考】
- Band 9: 满分 - 灵活准确，词汇丰富，语法完美
- Band 7: 良好 - 有效使用语言，小错误
- Band 5: 一般 - 部分掌握，中等错误
- Band 3: 有限 - 只能表达大致意思

【输出格式 - JSON】
{
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "correctAnswers": ["B"],
      "explanation": "答案解释"
    },
    {
      "type": "fill_blank",
      "question": "句子包含<!--BLANK-->标记",
      "blanks": 2,
      "correctAnswers": ["答案1", "答案2"],
      "explanation": "解题思路"
    },
    {
      "type": "open_ended",
      "question": "开放性问题",
      "sampleAnswer": "参考答案要点（用于LLM评分参考，不展示给用户）",
      "rubric": {
        "bands": {
          "9": {"min": 90, "max": 100, "description": "完美回答"},
          "7": {"min": 70, "max": 89, "description": "良好"},
          "5": {"min": 50, "max": 69, "description": "一般"},
          "3": {"min": 0, "max": 49, "description": "需改进"}
        },
        "criteria": ["relevance", "accuracy", "fluency", "vocabulary"]
      }
    },
    {
      "type": "translation",
      "question": {"direction": "to_native", "text": "要翻译的句子"},
      "correctAnswers": ["标准翻译"]
    },
    {
      "type": "word_explanation",
      "question": "解释以下词语：semantic分析",
      "sampleAnswer": "参考答案"
    },
    {
      "type": "sentence_imitation",
      "question": {"example": "原文例句", "instruction": "模仿结构造句"},
      "sampleAnswer": "模仿示例"
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

// Grade Exercises with IELTS-based evaluation
export async function gradeExercises(
  exercisesJson: string,
  userAnswersJson: string,
  articleContent: string,
  wordListJson: string,
  options?: {
    userNativeLanguage?: string;
    userTargetLanguage?: string;
    userLevel?: string;
  }
): Promise<GradingResult> {
  const [aiSettings, userSettings] = await Promise.all([
    getAISettings(),
    getUserSettings(),
  ]);

  if (!aiSettings) {
    throw new Error('AI settings not configured');
  }

  const targetLanguage = options?.userTargetLanguage || userSettings?.targetLanguage || 'English';
  const nativeLanguage = options?.userNativeLanguage || userSettings?.nativeLanguage || 'Chinese';
  const currentLevel = options?.userLevel || userSettings?.currentLevel || 'A2';

  // Parse exercises to understand question types
  let exercises: Array<{
    id?: number;
    type: ExerciseType;
    question: string;
    options?: string[] | null;
    correctAnswers?: string[];
    blanks?: number;
    sampleAnswer?: string;
    rubric?: ExerciseResult['rubric'];
  }>;
  try {
    exercises = JSON.parse(exercisesJson);
  } catch {
    throw new Error('Failed to parse exercises JSON');
  }

  let userAnswers: Array<{ questionIndex: number; answer: string }>;
  try {
    userAnswers = JSON.parse(userAnswersJson);
  } catch {
    throw new Error('Failed to parse user answers JSON');
  }

  // Separate objective and open-ended questions
  const objectiveTypes: ExerciseType[] = ['choice', 'fill_blank', 'translation'];
  const openEndedTypes: ExerciseType[] = ['open_ended', 'word_explanation', 'sentence_imitation'];

  const objectiveQuestions = exercises.filter(e => objectiveTypes.includes(e.type));
  const openEndedQuestions = exercises.filter(e => openEndedTypes.includes(e.type));

  const gradingMessages: ChatMessage[] = [
    {
      role: 'user',
      content: `【任务】使用IELTS标准批改语言学习练习

【用户信息】
- 目标语言：${targetLanguage}
- 母语：${nativeLanguage}
- 当前等级：${currentLevel}

【文章内容】
${articleContent}

【单词表】
${wordListJson}

【题目和用户答案】
${userAnswersJson}

【题目详情】
${exercisesJson}

【评分标准 - IELTS Bands】
- Band 9 (90-100分): 满分 - 完全掌握，词汇丰富精确，语法完美，表述流畅
- Band 8 (80-89分): 优秀 - 完全有效，偶有微小不准确
- Band 7 (70-79分): 良好 - 有效掌握，轻微错误
- Band 6 (60-69分): 合格 - 基本有效，但有不准确或偏差
- Band 5 (50-59分): 一般 - 部分掌握，中等错误
- Band 4 (40-49分): 有限 - 基本能力，频繁错误
- Band 3 (30-39分): 非常有限 - 只能传达一般含义
- Band 2 (10-29分): 间歇性 - 非常有限的能力
- Band 1 (1-9分): 非用户 - 无法使用语言
- Band 0 (0分): 未尝试

【评分要求】

1. 客观题（选择题、填空题、翻译题）：
   - exact match得分
   - 部分得分适用于多空填空题（每空独立计分）
   - 翻译题需考虑语义等价，不必须字面匹配

2. 开放式问题（问答题、词语解释、句子模仿）：
   - 按以下标准评分：
     * relevance (相关性): 回答是否切题
     * accuracy (准确性): 语言是否正确
     * fluency (流畅性): 表达是否自然流畅
     * vocabulary (词汇): 词汇使用是否恰当丰富
   - 每个标准25%权重
   - 参考sampleAnswer但不强求一致
   - 重点评估整体语言能力

3. 输出bandScore表示IELTS band等级(0-9)

4. 逐题解析（analysis）要求 - 每道题必须包含详细分析：
   - isCorrect: 答案是否正确
   - correctAnswer: 正确答案
   - keyPoints: 涉及的关键知识点（数组）
   - explanation: 详细解释为什么该答案正确或错误，结合题目和用户答案进行分析
   - improvementSuggestions: 针对该题的具体改进建议（数组）
   - 分析应该帮助用户真正理解，而不是仅仅告知对错

【输出格式 - JSON】
{
  "totalScore": 85,
  "bandScore": 7,
  "results": [
    {
      "questionIndex": 0,
      "exerciseId": 1,
      "type": "choice",
      "correct": true,
      "userAnswer": "用户答案",
      "expectedAnswer": "正确答案",
      "score": 100,
      "maxScore": 100,
      "bandScore": 9,
      "comment": "评价说明",
      "analysis": {
        "isCorrect": true,
        "correctAnswer": "正确答案",
        "keyPoints": ["关键点1", "关键点2"],
        "explanation": "详细解释为什么答案正确/错误",
        "improvementSuggestions": ["改进建议1", "改进建议2"]
      }
    },
    {
      "questionIndex": 1,
      "exerciseId": 2,
      "type": "fill_blank",
      "correct": false,
      "userAnswer": "用户填写的答案",
      "expectedAnswer": "正确答案",
      "score": 50,
      "maxScore": 100,
      "bandScore": 5,
      "comment": "部分正确，第二个空错误",
      "analysis": {
        "isCorrect": false,
        "correctAnswer": "正确答案",
        "keyPoints": ["关键点1", "关键点2"],
        "explanation": "详细解释为什么答案正确/错误",
        "improvementSuggestions": ["改进建议1", "改进建议2"]
      }
    }
  ],
  "overallComment": "总体评价",
  "strengths": ["优点1", "优点2"],
  "areasForImprovement": ["改进点1", "改进点2"]
}`,
    },
  ];

  const response = await chatWithRetry(gradingMessages, aiSettings);
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse grading response');
  }

  const gradingResult = JSON.parse(jsonMatch[0]) as GradingResult;

  // Ensure bandScore is an integer
  gradingResult.bandScore = Math.round(gradingResult.bandScore);

  return gradingResult;
}

// Export prisma for use in routes
export { prisma };
