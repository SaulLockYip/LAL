const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'An error occurred');
  }

  return data.data as T;
}

// Types
export interface Article {
  id: string;
  title: string;
  content: string;
  source: string;
  notes: string;
  createdAt: string;
  archived: boolean;
  level: string;
  currentSessionFilePath: string;
}

export interface Word {
  id: number;
  articleId: string;
  word: string;
  partOfSpeech: string;
  phonetic: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  field: string;
  inflections: Record<string, string>;
  synonyms: string[];
  phrases: string[];
  derivation: {
    prefix: string;
    prefixMeaning: string;
    root: string;
    rootPid: string;
    rootMeaning: string;
    suffix: string;
    suffixMeaning: string;
  } | null;
  etymology: {
    explanation: string;
    explanationTranslation: string;
  } | null;
  createdAt?: string;
}

export type ExerciseType = 'choice' | 'fill_blank' | 'open_ended' | 'translation' | 'word_explanation' | 'sentence_imitation';

export interface ExerciseRubric {
  bands: Record<string, { min: number; max: number; description: string }>;
  criteria: string[];
}

export interface Exercise {
  id: number;
  articleId: string;
  type: ExerciseType;
  questionContent: string | {
    direction?: 'to_native' | 'to_target';
    text?: string;
    example?: string;
    instruction?: string;
  };
  options: string[] | null;
  correctAnswers: string[] | null;
  rubric: ExerciseRubric | null;
  sampleAnswer: string | null;
  partialScoring: { totalBlanks: number } | null;
  explanation: string | null;
  status: 'pending' | 'submitted' | 'graded';
  score: number | null;
  bandScore: number | null;
  comments: string | null;
  createdAt?: string;
  sessionId: string | null;
  article?: Article;
}

export interface User {
  id: number;
  name: string;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string;
  voice: string | null;
  // TTS Settings
  ttsVoiceId?: string | null;
  ttsSpeed?: number | null;
  ttsVol?: number | null;
  ttsPitch?: number | null;
  ttsEmotion?: string | null;
  ttsAudioSampleRate?: number | null;
  ttsBitrate?: number | null;
  ttsChannel?: number | null;
  ttsSoundEffects?: string | null;
  ttsApiKey?: string | null;
}

export interface AISettings {
  provider: 'openai' | 'anthropic';
  modelName: string;
  apiKey: string;
  baseUrl: string;
}

// TTS Types
export interface TTSVoice {
  voice_id: string;
  voice_name: string;
  description: string[];
}

export interface TTSResult {
  audioData: string;
  sentences: SentenceTiming[];
}

// Sentence timing data for TTS word highlighting
export interface SentenceTiming {
  text: string;
  start: number;
  end: number;
}

// API Functions
export async function getArticles(params?: {
  search?: string;
  level?: string;
  sortBy?: 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
}): Promise<Article[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.level) searchParams.set('level', params.level);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  return fetchApi<Article[]>(`/articles${query ? `?${query}` : ''}`);
}

export async function getArticle(id: string): Promise<Article> {
  return fetchApi<Article>(`/articles/${id}`);
}

export async function createWord(word: Omit<Word, 'id' | 'createdAt'>): Promise<Word> {
  return fetchApi<Word>('/words', {
    method: 'POST',
    body: JSON.stringify(word),
  });
}

export async function getWords(params?: {
  articleId?: string;
  search?: string;
  sortBy?: 'date' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}): Promise<Word[]> {
  const searchParams = new URLSearchParams();
  if (params?.articleId) searchParams.set('articleId', params.articleId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  return fetchApi<Word[]>(`/words${query ? `?${query}` : ''}`);
}

// Progress info type
export interface ProgressInfo {
  current: number;
  total: number;
  currentStep: string;
  status: 'generating' | 'grading' | 'completed';
}

// Generate exercise with progress callback
export async function generateExercise(
  articleId: string,
  onProgress?: (progress: ProgressInfo) => void
): Promise<Exercise[]> {
  const response = await fetch(`${API_BASE}/exercises/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ articleId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to generate exercises');
  }

  // Handle streaming response (NDJSON)
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: Exercise[] | null = null;
  let sessionId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        if (parsed.success && parsed.data) {
          if (parsed.data.progress) {
            // Progress update
            onProgress?.(parsed.data.progress);
          }
          if (parsed.data.exercises) {
            // Final response with exercises
            finalData = parsed.data.exercises;
            sessionId = parsed.data.sessionId;
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  if (!finalData) {
    throw new Error('Failed to generate exercises: no data received');
  }

  // Attach sessionId to exercises for later use
  if (sessionId) {
    finalData = finalData.map(ex => ({ ...ex, sessionId }));
  }

  return finalData;
}

export interface GradingResult {
  totalScore: number;
  bandScore: number;
  overallComment: string;
  strengths: string[];
  areasForImprovement: string[];
}

// Submit exercise with progress callback
export async function submitExercise(
  exerciseId: number,
  answers: string[],
  sessionId?: string,
  onProgress?: (progress: ProgressInfo) => void
): Promise<{ exercises: Exercise[]; grading: GradingResult }> {
  // Convert answers array to the format expected by backend: [{ questionIndex, answer }]
  const formattedAnswers = answers.map((answer, index) => ({
    questionIndex: index,
    answer,
  }));

  const response = await fetch(`${API_BASE}/exercises/${exerciseId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers: formattedAnswers, sessionId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to submit exercise');
  }

  // Handle streaming response (NDJSON)
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: { exercises: Exercise[]; grading: GradingResult } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        if (parsed.success && parsed.data) {
          if (parsed.data.progress) {
            // Progress update
            onProgress?.(parsed.data.progress);
          }
          if (parsed.data.exercises && parsed.data.grading) {
            // Final response
            finalData = {
              exercises: parsed.data.exercises,
              grading: parsed.data.grading,
            };
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  if (!finalData) {
    throw new Error('Failed to submit exercise: no data received');
  }

  return finalData;
}

export async function getExercises(articleId: string): Promise<Exercise[]> {
  return fetchApi<Exercise[]>(`/exercises?articleId=${articleId}`);
}

export async function getUser(): Promise<User> {
  return fetchApi<User>('/settings/user');
}

export async function updateUser(user: Partial<User>): Promise<User> {
  return fetchApi<User>('/settings/user', {
    method: 'PUT',
    body: JSON.stringify(user),
  });
}

export async function getAISettings(): Promise<AISettings> {
  return fetchApi<AISettings>('/settings/ai');
}

export async function updateAISettings(settings: Partial<AISettings>): Promise<AISettings> {
  return fetchApi<AISettings>('/settings/ai', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function testAISettings(settings: { provider: string; modelName: string; apiKey: string; baseUrl: string }): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>('/settings/ai/test', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// Word lookup with context (uses AI)
export interface WordLookupResult {
  word: string;
  partOfSpeech: string;
  phonetic: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  inflections: Record<string, string>;
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

// TTS API Functions
export async function getTTSVoices(language?: string): Promise<TTSVoice[]> {
  const url = language
    ? `/settings/tts-voices?language=${encodeURIComponent(language)}`
    : '/settings/tts-voices';
  return fetchApi<TTSVoice[]>(url);
}

export async function generateTTS(articleId: string): Promise<TTSResult> {
  return fetchApi<TTSResult>(`/articles/${articleId}/tts`, { method: 'POST' });
}

export async function getTTS(articleId: string): Promise<TTSResult | null> {
  try {
    const response = await fetch(`/api/articles/${articleId}/tts`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      return null;  // TTS not found or error
    }
    return data.data;
  } catch {
    return null;
  }
}

export async function deleteWord(wordId: number): Promise<void> {
  await fetchApi<void>(`/words/${wordId}`, {
    method: 'DELETE',
  });
}

export async function deleteArticle(articleId: string): Promise<void> {
  await fetchApi<void>(`/articles/${articleId}`, {
    method: 'DELETE',
  });
}

export async function deleteExercise(exerciseId: number): Promise<void> {
  await fetchApi<void>(`/exercises/${exerciseId}`, {
    method: 'DELETE',
  });
}

export async function deleteAllExercises(articleId: string): Promise<{ deleted: number }> {
  return fetchApi<{ deleted: number }>(`/exercises/article/${articleId}`, {
    method: 'DELETE',
  });
}

// TTS Entry type (returned from GET /api/tts)
export interface TTSEntry {
  id: string;
  articleId: string;
  audioData: string;
  sentenceData: SentenceTiming[] | null;
  createdAt: string;
}

export async function getAllTTS(): Promise<TTSEntry[]> {
  return fetchApi<TTSEntry[]>('/tts');
}

export async function deleteTTS(id: string): Promise<void> {
  await fetchApi<void>(`/tts/${id}`, {
    method: 'DELETE',
  });
}
