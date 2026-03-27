import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, Play, Send, GripVertical, List, Bot, Volume2, Trash2 } from 'lucide-react';
import { getArticle, getWords, createWord, deleteWord, generateExercise, submitExercise, getExercises, Article, Word, WordLookupResult, DerivationEtymologyResult, getTTS, Exercise, SentenceTiming, ProgressInfo } from '../services/api';
import { Sentence } from '../services/tts';
import { ChatBox } from '../components/ChatBox/ChatBox';
import { WordCard } from '../components/WordCard';
import { TTSPlayer } from '../components/TTSPlayer';

const PENDING_LOOKUP_PREFIX = 'pending_word_lookup_';
const PENDING_LOOKUP_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Word lookup optimization: in-memory cache with max size
const WORD_CACHE_MAX_SIZE = 100;
const wordCache = new Map<string, {
  wordData: WordLookupResult;
  timestamp: number;
}>();

// Track pending request to cancel on new lookup
let pendingLookupController: AbortController | null = null;

// Prefetch hover delay (ms)
const PREFETCH_HOVER_DELAY_MS = 300;

// Cache eviction helper - removes oldest entries if cache is full
function evictCacheIfNeeded() {
  if (wordCache.size >= WORD_CACHE_MAX_SIZE) {
    // Find and remove the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, value] of wordCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      wordCache.delete(oldestKey);
    }
  }
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<Article | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Split view state
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Word card state
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    position: { x: number; y: number };
    context: string;
  } | null>(null);
  const [wordData, setWordData] = useState<WordLookupResult | null>(null);
  const [savedWord, setSavedWord] = useState<Word | null>(null);
  const [derivationData, setDerivationData] = useState<DerivationEtymologyResult | null>(null);
  const [etymologyData, setEtymologyData] = useState<DerivationEtymologyResult | null>(null);
  const [isLoadingDerivation, setIsLoadingDerivation] = useState(false);
  const [isLoadingEtymology, setIsLoadingEtymology] = useState(false);
  const [isLoadingWord, setIsLoadingWord] = useState(false);

  // Prefetch state for hover
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedWordsRef = useRef<Set<string>>(new Set());

  // User info for context
  const [userInfo, setUserInfo] = useState<{
    targetLanguage: string;
    nativeLanguage: string;
    currentLevel: string;
    voice: string | null;
  } | null>(null);

  // Exercise state
  const [exerciseMode, setExerciseMode] = useState(false);
  const [exercise, setExercise] = useState<any | null>(null);
  const [isGeneratingExercise, setIsGeneratingExercise] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<number, string | string[]>>({});
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [exerciseResults, setExerciseResults] = useState<any | null>(null);
  const [generationProgress, setGenerationProgress] = useState<ProgressInfo | null>(null);
  const [gradingProgress, setGradingProgress] = useState<ProgressInfo | null>(null);

  // TTS state
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [ttsSentences, setTtsSentences] = useState<SentenceTiming[]>([]);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [showTTSPlayer, setShowTTSPlayer] = useState(false);
  const [ttsCurrentWordIndex, setTtsCurrentWordIndex] = useState(-1);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Right panel tab state (Word List vs Chat)
  const [rightPanelTab, setRightPanelTab] = useState<'words' | 'chat'>('chat');

  // localStorage functions for pending lookups
  const getPendingLookupKey = useCallback((word: string) => {
    return `${PENDING_LOOKUP_PREFIX}${word.toLowerCase()}`;
  }, []);

  const savePendingLookup = useCallback((word: string, data: {
    wordData: WordLookupResult | null;
    derivationData: DerivationEtymologyResult | null;
    etymologyData: DerivationEtymologyResult | null;
  }) => {
    try {
      const key = getPendingLookupKey(word);
      const value = JSON.stringify({ ...data, timestamp: Date.now() });
      localStorage.setItem(key, value);
    } catch (err) {
      console.error('Failed to save pending lookup to localStorage:', err);
    }
  }, [getPendingLookupKey]);

  const removePendingLookup = useCallback((word: string) => {
    try {
      const key = getPendingLookupKey(word);
      localStorage.removeItem(key);
    } catch (err) {
      console.error('Failed to remove pending lookup from localStorage:', err);
    }
  }, [getPendingLookupKey]);

  const loadPendingLookup = useCallback((word: string): {
    wordData: WordLookupResult | null;
    derivationData: DerivationEtymologyResult | null;
    etymologyData: DerivationEtymologyResult | null;
  } | null => {
    try {
      const key = getPendingLookupKey(word);
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const data = JSON.parse(stored);
      // Check if data is older than 24 hours
      if (Date.now() - data.timestamp > PENDING_LOOKUP_EXPIRY_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return {
        wordData: data.wordData,
        derivationData: data.derivationData,
        etymologyData: data.etymologyData,
      };
    } catch (err) {
      console.error('Failed to load pending lookup from localStorage:', err);
      return null;
    }
  }, [getPendingLookupKey]);

  // Cleanup old pending lookups on page load
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PENDING_LOOKUP_PREFIX)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            if (Date.now() - data.timestamp > PENDING_LOOKUP_EXPIRY_MS) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.error('Failed to cleanup old pending lookups:', err);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadArticle();
      loadWords();
      loadExercises();
    }
  }, [id]);

  useEffect(() => {
    loadUserInfo();
  }, []);

  // Load existing TTS on mount
  useEffect(() => {
    async function loadTTS() {
      if (!id) return;
      try {
        const data = await getTTS(id);
        if (data?.audioData) {
          setTtsAudio(data.audioData);
          // If sentences are returned with the TTS data, use them
          if (data.sentences && data.sentences.length > 0) {
            setTtsSentences(data.sentences);
          }
        }
      } catch {}
    }
    loadTTS();
  }, [id]);

  async function loadUserInfo() {
    try {
      const response = await fetch('/api/settings/user');
      const data = await response.json();
      if (data.success) {
        setUserInfo({
          targetLanguage: data.data.targetLanguage,
          nativeLanguage: data.data.nativeLanguage,
          currentLevel: data.data.currentLevel,
          voice: data.data.voice || null,
        });
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  }

  async function loadArticle() {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getArticle(id);
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }

  async function loadWords() {
    if (!id) return;
    try {
      const data = await getWords({ articleId: id });
      setWords(data);
    } catch (err) {
      console.error('Failed to load words:', err);
    }
  }

  async function loadExercises() {
    if (!id) return;
    try {
      const data = await getExercises(id);
      if (data && data.length > 0) {
        setExercise(data);
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
    }
  }

  const handleWordClick = useCallback((word: string, event: React.MouseEvent) => {
    // Clear any prefetch timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setSelectedWord({
      word,
      position: { x: rect.left, y: rect.bottom + 10 },
      context: '',
    });

    // Check if word is already saved
    const existingWord = words.find((w) => w.word.toLowerCase() === word.toLowerCase());
    if (existingWord) {
      setSavedWord(existingWord);
      setWordData(null);
      setDerivationData(null);
      setEtymologyData(null);
      setIsLoadingWord(false);
      // Remove from prefetch cache since we have saved word
      prefetchedWordsRef.current.delete(word.toLowerCase());
      return;
    }

    // Check in-memory cache first
    const cachedLookup = wordCache.get(word.toLowerCase());
    if (cachedLookup) {
      setSavedWord(null);
      setWordData(cachedLookup.wordData);
      setDerivationData(null);
      setEtymologyData(null);
      setIsLoadingWord(false);
      // Update localStorage with cached data
      savePendingLookup(word, {
        wordData: cachedLookup.wordData,
        derivationData: null,
        etymologyData: null,
      });
      // Get context from surrounding text
      const selection = window.getSelection();
      const context = selection?.toString() || '';
      setSelectedWord((prev) => prev ? { ...prev, context } : null);
      return;
    }

    // Check for pending lookup in localStorage
    const pendingData = loadPendingLookup(word);
    if (pendingData) {
      setSavedWord(null);
      setWordData(pendingData.wordData);
      setDerivationData(pendingData.derivationData);
      setEtymologyData(pendingData.etymologyData);
      setIsLoadingWord(false);
      // Also cache in memory
      if (pendingData.wordData) {
        evictCacheIfNeeded();
        wordCache.set(word.toLowerCase(), { wordData: pendingData.wordData, timestamp: Date.now() });
      }
      // Get context from surrounding text
      const selection = window.getSelection();
      const context = selection?.toString() || '';
      setSelectedWord((prev) => prev ? { ...prev, context } : null);
      return;
    }

    setSavedWord(null);
    setWordData(null);
    setDerivationData(null);
    setEtymologyData(null);
    setIsLoadingWord(true); // Show loading immediately

    // Get context from surrounding text
    const selection = window.getSelection();
    const context = selection?.toString() || '';
    setSelectedWord((prev) => prev ? { ...prev, context } : null);

    // Lookup word via AI (only if not already saved and no pending data)
    if (!existingWord && !loadPendingLookup(word)) {
      lookupWord(word, context);
    }
  }, [words, loadPendingLookup]);

  const handleSavedWordClick = useCallback((word: Word) => {
    // Position the WordCard in the center-bottom of the viewport
    setSelectedWord({
      word: word.word,
      position: { x: window.innerWidth / 2, y: window.innerHeight - 100 },
      context: '',
    });
    setSavedWord(word);
    setWordData(null);
    setIsLoadingWord(false);
  }, []);

  async function lookupWord(word: string, context: string) {
    if (!article) return;

    // Cancel any pending request
    if (pendingLookupController) {
      pendingLookupController.abort();
    }
    pendingLookupController = new AbortController();

    // Decode article content once and cache it
    const decodedArticleContent = (() => {
      let content = article.content;
      try {
        const decoded = atob(content);
        if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
          content = atob(decoded);
        } else {
          content = decoded;
        }
      } catch {
        // Content might not be base64 encoded
      }
      return content;
    })();

    try {
      const response = await fetch('/api/words/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          articleId: id,
          articleContent: decodedArticleContent,
          context,
          userInfo,
        }),
        signal: pendingLookupController.signal,
      });

      const data = await response.json();
      if (data.success) {
        // Cache in memory
        evictCacheIfNeeded();
        wordCache.set(word.toLowerCase(), { wordData: data.data, timestamp: Date.now() });

        setWordData(data.data);
        // Save to localStorage as pending lookup
        savePendingLookup(word, {
          wordData: data.data,
          derivationData: null,
          etymologyData: null,
        });
      } else {
        throw new Error(data.error?.message || 'Failed to lookup word');
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Word lookup error:', err);
    } finally {
      setIsLoadingWord(false);
      pendingLookupController = null;
    }
  }

  // Prefetch word on hover for faster subsequent clicks
  const prefetchWord = useCallback((word: string) => {
    // Skip if already saved, already cached, already prefetched, or currently selected
    const existingWord = words.find((w) => w.word.toLowerCase() === word.toLowerCase());
    if (existingWord) return;
    if (wordCache.has(word.toLowerCase())) return;
    if (prefetchedWordsRef.current.has(word.toLowerCase())) return;
    if (selectedWord?.word.toLowerCase() === word.toLowerCase()) return;

    // Mark as prefetched
    prefetchedWordsRef.current.add(word.toLowerCase());

    // Prefetch after delay
    const timeoutId = setTimeout(async () => {
      // Double-check still needed after delay
      if (wordCache.has(word.toLowerCase())) return;
      if (selectedWord?.word.toLowerCase() === word.toLowerCase()) return;

      // Decode article content
      const decodedArticleContent = (() => {
        let content = article?.content || '';
        try {
          const decoded = atob(content);
          if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
            content = atob(decoded);
          } else {
            content = decoded;
          }
        } catch {
          // Content might not be base64 encoded
        }
        return content;
      })();

      try {
        const response = await fetch('/api/words/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word,
            articleId: id,
            articleContent: decodedArticleContent,
            context: '',
            userInfo,
          }),
        });

        const data = await response.json();
        if (data.success && data.data) {
          // Cache the result silently
          evictCacheIfNeeded();
          wordCache.set(word.toLowerCase(), { wordData: data.data, timestamp: Date.now() });
          // Also save to localStorage
          savePendingLookup(word, {
            wordData: data.data,
            derivationData: null,
            etymologyData: null,
          });
        }
      } catch (err) {
        // Silently fail prefetch
        if (err instanceof Error && err.name === 'AbortError') return;
        console.debug('Prefetch failed:', err);
      }
    }, PREFETCH_HOVER_DELAY_MS);

    prefetchTimeoutRef.current = timeoutId;
  }, [words, selectedWord, article, id, savePendingLookup]);

  // Cancel prefetch on mouse leave
  const cancelPrefetch = useCallback((word: string) => {
    prefetchedWordsRef.current.delete(word.toLowerCase());
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);

  async function handleAddToWordList() {
    if (!wordData || !id) return;

    try {
      const newWord = await createWord({
        articleId: id,
        word: wordData.word,
        partOfSpeech: wordData.partOfSpeech,
        phonetic: wordData.phonetic,
        definition: wordData.definition,
        translation: wordData.translation,
        exampleSentence: wordData.exampleSentence,
        field: wordData.field,
        inflections: wordData.inflections,
        synonyms: wordData.synonyms,
        phrases: wordData.phrases,
        derivation: derivationData?.derivation || null,
        etymology: etymologyData?.etymology || null,
      });

      setWords((prev) => [...prev, newWord]);
      setSavedWord(newWord);

      // Remove from localStorage after successful save
      if (selectedWord) {
        removePendingLookup(selectedWord.word);
      }
    } catch (err) {
      console.error('Failed to add word:', err);
    }
  }

  async function handleDeleteWord(wordId: number) {
    try {
      await deleteWord(wordId);
      setWords((prev) => prev.filter((w) => w.id !== wordId));
    } catch (err) {
      console.error('Failed to delete word:', err);
    }
  }

  async function handleGetDerivation() {
    if (!selectedWord?.word) return;

    setIsLoadingDerivation(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

      const response = await fetch('/api/words/derivation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedWord.word,
          articleId: id,
          userInfo,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        setDerivationData(data.data);
        // Update localStorage with new derivation data
        savePendingLookup(selectedWord.word, {
          wordData,
          derivationData: data.data,
          etymologyData,
        });
      }
    } catch (err) {
      console.error('Failed to get derivation:', err);
    } finally {
      setIsLoadingDerivation(false);
    }
  }

  async function handleGetEtymology() {
    if (!selectedWord?.word) return;

    setIsLoadingEtymology(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

      const response = await fetch('/api/words/etymology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedWord.word,
          articleId: id,
          userInfo,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success) {
        setEtymologyData(data.data);
        // Update localStorage with new etymology data
        savePendingLookup(selectedWord.word, {
          wordData,
          derivationData,
          etymologyData: data.data,
        });
      }
    } catch (err) {
      console.error('Failed to get etymology:', err);
    } finally {
      setIsLoadingEtymology(false);
    }
  }

  function handleCloseWordCard() {
    setSelectedWord(null);
    setWordData(null);
    setSavedWord(null);
    setDerivationData(null);
    setEtymologyData(null);
  }

  // Draggable divider
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelWidth(Math.max(30, Math.min(70, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Generate exercise
  async function handleGenerateExercise() {
    if (!id) return;

    setIsGeneratingExercise(true);
    setExerciseAnswers({});
    setExerciseResults(null);
    setGenerationProgress({ current: 0, total: 0, currentStep: 'Starting...', status: 'generating' });
    try {
      const newExercise = await generateExercise(id, (progress) => {
        setGenerationProgress(progress);
      });
      setExercise(newExercise);
    } catch (err) {
      console.error('Failed to generate exercise:', err);
    } finally {
      setIsGeneratingExercise(false);
      setGenerationProgress(null);
    }
  }

  async function handleStartExercise() {
    setExerciseMode(true);
  }

  async function handleSubmitExercise() {
    if (!exercise || exercise.length === 0) return;

    setIsSubmittingExercise(true);
    setGradingProgress({ current: 0, total: 0, currentStep: 'Starting grading...', status: 'grading' });
    try {
      // Flatten answers: multi-blank questions have string[] values, flatten to single array
      const rawAnswers = Object.values(exerciseAnswers);
      const answers: string[] = [];
      for (const ans of rawAnswers) {
        if (Array.isArray(ans)) {
          answers.push(...ans);
        } else {
          answers.push(ans);
        }
      }
      // Use the first exercise's ID for grading (backend grades all exercises for the article)
      const sessionId = exercise[0]?.sessionId;
      const results = await submitExercise(exercise[0].id, answers, sessionId, (progress) => {
        setGradingProgress(progress);
      });
      setExercise(results.exercises);
      setExerciseResults(results);
    } catch (err) {
      console.error('Failed to submit exercise:', err);
    } finally {
      setIsSubmittingExercise(false);
      setGradingProgress(null);
    }
  }

  function handleExitExercise() {
    setExerciseMode(false);
    setExerciseAnswers({});
    setExerciseResults(null);
  }

  // TTS handlers
  async function handleGenerateTTS() {
    if (!id) return;
    setIsGeneratingTTS(true);
    setTtsProgress(0);
    setTtsError(null);  // Clear previous errors
    try {
      // Poll progress simulation
      const progressInterval = setInterval(() => {
        setTtsProgress(p => Math.min(p + 10, 90));
      }, 2000);

      const response = await fetch(`/api/articles/${id}/tts`, { method: 'POST' });
      const data = await response.json();

      clearInterval(progressInterval);

      if (data.success) {
        setTtsProgress(100);
        setTtsAudio(data.data.audioData);
        // If sentences are returned with the TTS data, use them
        if (data.data.sentences && data.data.sentences.length > 0) {
          setTtsSentences(data.data.sentences);
        }
      } else {
        // API returned error
        setTtsError(data.error?.message || 'Failed to generate TTS');
        setTtsProgress(0);
      }
    } catch (err) {
      console.error('Failed to generate TTS:', err);
      setTtsError('Network error. Please try again.');
      setTtsProgress(0);
    } finally {
      setIsGeneratingTTS(false);
    }
  }

  function handlePlayTTS() {
    if (!ttsAudio) return;
    setShowTTSPlayer(true);
  }

  function handleCloseTTSPlayer() {
    setShowTTSPlayer(false);
  }

  // Decode and render article content
  function renderArticleContent() {
    if (!article) return '';

    let content = article.content;
    // Handle base64 encoding (for legacy data) - atob throws if content is already plain text
    try {
      const decoded = atob(content);
      // If the decoded content looks like base64 (only contains base64 chars), decode again
      if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
        content = atob(decoded);
      } else {
        content = decoded;
      }
    } catch (e) {
      // Content is not base64 encoded (backend now sends decoded content) - use as-is
    }

    // Split into paragraphs and make words clickable
    return content.split('\n').map((paragraph, i) => (
      <p key={i} className="mb-4 leading-relaxed">
        {paragraph.split(/\s+/).map((word, j) => {
          const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
          if (cleanWord.length < 2) return word + ' ';
          return (
            <span key={j}>
              <span
                onClick={(e) => handleWordClick(cleanWord, e)}
                onMouseEnter={() => prefetchWord(cleanWord)}
                onMouseLeave={() => cancelPrefetch(cleanWord)}
                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                {word}
              </span>{' '}
            </span>
          );
        })}
      </p>
    ));
  }

  // Render TTS-highlighted content (when TTS is playing)
  function renderTTSHighlightedContent() {
    if (!ttsSentences || ttsSentences.length === 0) return renderArticleContent();

    const elements: React.ReactNode[] = [];
    let wordIndex = 0;

    (ttsSentences as Sentence[]).forEach((sentence, sentenceIdx) => {
      const sentenceWords = sentence.text.split(/(\s+)/).filter(s => s.length > 0);

      sentenceWords.forEach((token, tokenIdx) => {
        if (/\s+/.test(token)) {
          // Whitespace
          elements.push(<span key={`ws-${sentenceIdx}-${tokenIdx}`}>{token}</span>);
        } else {
          // Word
          const isCurrentWord = wordIndex === ttsCurrentWordIndex;
          const isPastWord = wordIndex < ttsCurrentWordIndex;
          const highlightClass = isCurrentWord
            ? 'bg-yellow-400 dark:bg-yellow-500 text-black rounded px-0.5'
            : isPastWord
              ? 'text-gray-500 dark:text-gray-400'
              : '';
          elements.push(
            <span
              key={`word-${sentenceIdx}-${tokenIdx}`}
              className={`transition-colors duration-100 ${highlightClass}`}
            >
              {token}
            </span>
          );
          wordIndex++;
        }
      });

      // Add newline after each sentence (except last)
      if (sentenceIdx < ttsSentences.length - 1) {
        elements.push(<br key={`br-${sentenceIdx}`} />);
        elements.push(<span key={`space-${sentenceIdx}`}>{' '}</span>);
      }
    });

    return elements;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-600 dark:text-red-400">{error || 'Article not found'}</p>
          <button
            onClick={() => navigate('/articles')}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Back to articles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/articles')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-semibold flex-1 truncate">{article.title}</h1>
          <div className="flex items-center gap-2">
            {!exerciseMode && (
              <>
                {!ttsAudio && !isGeneratingTTS && (
                  <button
                    onClick={handleGenerateTTS}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    <Volume2 size={18} />
                    Generate Reading
                  </button>
                )}

                {isGeneratingTTS && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Generating... {ttsProgress}%</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${ttsProgress}%` }} />
                    </div>
                  </div>
                )}

                {ttsError && (
                  <div className="text-red-500 text-sm mt-2">
                    TTS Error: {ttsError}
                  </div>
                )}

                {ttsAudio && (
                  <button
                    onClick={handlePlayTTS}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    <Play size={18} />
                    Play Reading
                  </button>
                )}

                {!exercise || exercise.length === 0 ? (
                  isGeneratingExercise && generationProgress ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/80 text-white rounded-lg">
                      <Loader2 className="animate-spin" size={18} />
                      <span>{generationProgress.currentStep}</span>
                      <div className="w-24 h-2 bg-purple-300/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 50}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateExercise}
                      disabled={isGeneratingExercise}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {isGeneratingExercise ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      Generate Exercise
                    </button>
                  )
                ) : exerciseResults ? (
                  <button
                    onClick={handleStartExercise}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <Sparkles size={18} />
                    View Results
                  </button>
                ) : exerciseMode || Object.keys(exerciseAnswers).length > 0 ? (
                  <button
                    onClick={handleStartExercise}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    <Play size={18} />
                    Continue Exercise
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleStartExercise}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                      <Play size={18} />
                      Do Exercise
                    </button>
                  </>
                )}
              </>
            )}
            {exerciseMode && (
              <button
                onClick={handleExitExercise}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Exit Exercise
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Article Reader */}
        <div
          ref={containerRef}
          className={`overflow-y-auto p-8 ${showTTSPlayer ? 'pb-24' : ''}`}
          style={{ width: exerciseMode ? '50%' : `${leftPanelWidth}%` }}
        >
          <article className="max-w-3xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <header className="mb-6">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                {article.level || 'N/A'}
              </span>
              {article.source && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Source: {article.source}
                </p>
              )}
            </header>
            <div className="prose dark:prose-invert max-w-none">
              {showTTSPlayer ? renderTTSHighlightedContent() : renderArticleContent()}
            </div>
          </article>
        </div>

        {/* Divider */}
        {!exerciseMode && (
          <div
            className={`w-1 cursor-col-resize hover:bg-blue-300 dark:hover:bg-blue-600 transition-colors ${isDragging ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center justify-center h-full">
              <GripVertical size={16} className="text-gray-400" />
            </div>
          </div>
        )}

        {/* Right Panel - LLM Chat (when not in exercise mode) */}
        {!exerciseMode && (
          <div style={{ width: `${100 - leftPanelWidth}%` }} className="border-l border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Tab switcher */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setRightPanelTab('words')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  rightPanelTab === 'words'
                    ? 'text-blue-500 border-b-2 border-blue-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <List size={18} />
                Word List
                {words.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                    {words.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRightPanelTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  rightPanelTab === 'chat'
                    ? 'text-blue-500 border-b-2 border-blue-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Bot size={18} />
                Chat
              </button>
            </div>

            {/* Word List Panel */}
            {rightPanelTab === 'words' && (
              <div className="flex-1 overflow-y-auto">
                {words.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <List size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No words saved yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Click on words in the article to look them up and save
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    <div className="space-y-1">
                      {words.map((word) => (
                        <button
                          key={word.id}
                          onClick={() => handleSavedWordClick(word)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-500 transition-colors">
                              {word.word}
                            </span>
                            <div className="flex items-center gap-2">
                              {word.partOfSpeech && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                                  {word.partOfSpeech}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWord(word.id);
                                }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete word"
                              >
                                <Trash2 size={14} className="text-red-500 hover:text-red-600" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {word.definition}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat Panel */}
            {rightPanelTab === 'chat' && (
              <div className="relative h-full flex flex-col">
                <ChatBox
                  inline={true}
                  userInfo={userInfo ? {
                    targetLanguage: userInfo.targetLanguage,
                    nativeLanguage: userInfo.nativeLanguage,
                    currentLevel: userInfo.currentLevel,
                  } : undefined}
                  articleContext={id ? {
                    articleId: id,
                    articleTitle: article.title,
                    articleContent: (() => {
                      let content = article.content;
                      try {
                        const decoded = atob(content);
                        if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
                          content = atob(decoded);
                        } else {
                          content = decoded;
                        }
                      } catch {}
                      return content;
                    })(),
                  } : undefined}
                  wordListContext={{
                    wordList: words.map((w) => w.word),
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Exercise Panel (when in exercise mode) */}
        {exerciseMode && (
          <div className="w-1/2 bg-white/50 dark:bg-gray-800/50 overflow-y-auto p-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Exercise</h2>

              {exerciseResults ? (
                // Results view
                <div className="space-y-6">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-1">
                          Score: {exerciseResults.grading?.totalScore}/100
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          IELTS Band Score: {exerciseResults.grading?.bandScore}/9
                        </p>
                      </div>
                      <div className={`text-5xl font-bold ${
                        (exerciseResults.grading?.bandScore || 0) >= 7 ? 'text-green-500' :
                        (exerciseResults.grading?.bandScore || 0) >= 5 ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {exerciseResults.grading?.bandScore || 0}
                      </div>
                    </div>

                    {exerciseResults.grading?.overallComment && (
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {exerciseResults.grading.overallComment}
                      </p>
                    )}

                    {/* Strengths and Areas for Improvement */}
                    {exerciseResults.grading?.strengths?.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-green-600 dark:text-green-400 mb-1">Strengths:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                          {exerciseResults.grading.strengths.map((strength: string, i: number) => (
                            <li key={i}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {exerciseResults.grading?.areasForImprovement?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-orange-600 dark:text-orange-400 mb-1">Areas for Improvement:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                          {exerciseResults.grading.areasForImprovement.map((area: string, i: number) => (
                            <li key={i}>{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {exerciseResults.grading?.results?.map((result: any, index: number) => (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border ${
                          result.correct
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Question {index + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              result.type === 'choice' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600' :
                              result.type === 'fill_blank' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' :
                              result.type === 'open_ended' ? 'bg-green-100 dark:bg-green-900/50 text-green-600' :
                              result.type === 'translation' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600' :
                              result.type === 'word_explanation' ? 'bg-pink-100 dark:bg-pink-900/50 text-pink-600' :
                              result.type === 'sentence_imitation' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-600'
                            }`}>
                              {result.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              (result.score || 0) >= 70 ? 'text-green-600' :
                              (result.score || 0) >= 40 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {result.score}/{result.maxScore}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              result.correct
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                            }`}>
                              {result.correct ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Your answer:</span> {result.userAnswer}
                        </p>
                        {result.expectedAnswer && !result.correct && (
                          <p className="text-sm mb-1">
                            <span className="font-medium">Expected:</span> {result.expectedAnswer}
                          </p>
                        )}
                        {result.comment && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {result.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : exercise && exercise.length > 0 ? (
                // Exercise questions
                <div className="space-y-6">
                  {exercise.map((ex: Exercise, index: number) => (
                    <div
                      key={ex.id || index}
                      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          {/* Question type badge */}
                          <div className="mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              ex.type === 'choice' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' :
                              ex.type === 'fill_blank' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' :
                              ex.type === 'open_ended' ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' :
                              ex.type === 'translation' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' :
                              ex.type === 'word_explanation' ? 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400' :
                              ex.type === 'sentence_imitation' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {ex.type === 'choice' ? 'Multiple Choice' :
                               ex.type === 'fill_blank' ? 'Fill in the Blank' :
                               ex.type === 'open_ended' ? 'Open-ended' :
                               ex.type === 'translation' ? 'Translation' :
                               ex.type === 'word_explanation' ? 'Word Explanation' :
                               ex.type === 'sentence_imitation' ? 'Sentence Imitation' :
                               ex.type}
                            </span>
                          </div>

                          {/* Render question based on type */}
                          {ex.type === 'choice' && (
                            <>
                              <p className="font-medium mb-3">
                                {typeof ex.questionContent === 'string'
                                  ? ex.questionContent.replace(/<!--BOX-->/g, '______')
                                  : String(ex.questionContent)}
                              </p>
                              <div className="space-y-2">
                                {ex.options?.map((option: string, optIndex: number) => (
                                  <label
                                    key={optIndex}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${index}`}
                                      value={option}
                                      checked={exerciseAnswers[index] === option}
                                      onChange={() => setExerciseAnswers((prev) => ({ ...prev, [index]: option }))}
                                      className="w-4 h-4"
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}

                          {ex.type === 'fill_blank' && (() => {
                            // Get question text and count blanks
                            const questionText = typeof ex.questionContent === 'string'
                              ? ex.questionContent
                              : String(ex.questionContent);
                            const blankCount = (questionText.match(/<!--BLANK-->/g) || []).length || 1;
                            return (
                              <>
                                <p className="font-medium mb-3">
                                  {questionText.replace(/<!--BLANK-->/g, '______')}
                                </p>
                                <div className="space-y-2">
                                  {Array.from({ length: blankCount }).map((_, blankIndex) => (
                                    <input
                                      key={blankIndex}
                                      type="text"
                                      placeholder={`Answer for blank ${blankIndex + 1}...`}
                                      value={(Array.isArray(exerciseAnswers[index]) ? exerciseAnswers[index][blankIndex] : '') || ''}
                                      onChange={(e) => {
                                        const currentAnswers = Array.isArray(exerciseAnswers[index])
                                          ? [...exerciseAnswers[index]]
                                          : Array(blankCount).fill('');
                                        currentAnswers[blankIndex] = e.target.value;
                                        setExerciseAnswers((prev) => ({ ...prev, [index]: currentAnswers }));
                                      }}
                                      className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  ))}
                                </div>
                              </>
                            );
                          })()}

                          {ex.type === 'open_ended' && (
                            <>
                              <p className="font-medium mb-3">
                                {typeof ex.questionContent === 'string'
                                  ? ex.questionContent
                                  : String(ex.questionContent)}
                              </p>
                              <textarea
                                rows={4}
                                placeholder="Write your answer here..."
                                value={typeof exerciseAnswers[index] === 'string' ? exerciseAnswers[index] : ''}
                                onChange={(e) => setExerciseAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                              {ex.sampleAnswer && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  Sample reference (not shown during exercise): {typeof ex.sampleAnswer === 'string' ? ex.sampleAnswer : JSON.stringify(ex.sampleAnswer)}
                                </p>
                              )}
                            </>
                          )}

                          {ex.type === 'translation' && (
                            <>
                              {typeof ex.questionContent === 'object' && ex.questionContent ? (
                                <div className="mb-3">
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                    {ex.questionContent.direction === 'to_native'
                                      ? `Translate to ${userInfo?.nativeLanguage || 'your native language'}:`
                                      : `Translate to ${userInfo?.targetLanguage || 'target language'}:`}
                                  </p>
                                  <p className="font-medium text-lg">
                                    {ex.questionContent.text}
                                  </p>
                                </div>
                              ) : (
                                <p className="font-medium mb-3">{String(ex.questionContent)}</p>
                              )}
                              <input
                                type="text"
                                placeholder="Your translation..."
                                value={typeof exerciseAnswers[index] === 'string' ? exerciseAnswers[index] : ''}
                                onChange={(e) => setExerciseAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </>
                          )}

                          {ex.type === 'word_explanation' && (
                            <>
                              <p className="font-medium mb-3">
                                {typeof ex.questionContent === 'string'
                                  ? ex.questionContent
                                  : String(ex.questionContent)}
                              </p>
                              <textarea
                                rows={3}
                                placeholder="Explain the meaning..."
                                value={typeof exerciseAnswers[index] === 'string' ? exerciseAnswers[index] : ''}
                                onChange={(e) => setExerciseAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </>
                          )}

                          {ex.type === 'sentence_imitation' && (
                            <>
                              {typeof ex.questionContent === 'object' && ex.questionContent ? (
                                <div className="mb-3">
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Example sentence:</p>
                                  <p className="font-medium italic text-lg mb-2">
                                    "{ex.questionContent.example}"
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {ex.questionContent.instruction || 'Imitate the structure to create your own sentence'}
                                  </p>
                                </div>
                              ) : (
                                <p className="font-medium mb-3">{String(ex.questionContent)}</p>
                              )}
                              <textarea
                                rows={3}
                                placeholder="Write your imitation sentence..."
                                value={typeof exerciseAnswers[index] === 'string' ? exerciseAnswers[index] : ''}
                                onChange={(e) => setExerciseAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isSubmittingExercise && gradingProgress ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-4 bg-blue-500/80 text-white rounded-lg">
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="font-medium">{gradingProgress.currentStep}</span>
                      </div>
                      <div className="w-full max-w-xs h-2 bg-blue-300/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${gradingProgress.total > 0 ? (gradingProgress.current / gradingProgress.total) * 100 : 50}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleSubmitExercise}
                      disabled={isSubmittingExercise || Object.keys(exerciseAnswers).length === 0}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {isSubmittingExercise ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <Send size={20} />
                      )}
                      Submit Answers
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Click "Generate Exercise" to create an exercise for this article.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Word Card */}
      {selectedWord && (
        <WordCard
          wordData={wordData}
          savedWord={savedWord}
          position={selectedWord.position}
          onClose={handleCloseWordCard}
          onAddToWordList={handleAddToWordList}
          onGetDerivation={handleGetDerivation}
          onGetEtymology={handleGetEtymology}
          isLoadingDerivation={isLoadingDerivation}
          isLoadingEtymology={isLoadingEtymology}
          isLoadingWord={isLoadingWord}
          derivationData={derivationData}
          etymologyData={etymologyData}
          userInfo={userInfo || undefined}
        />
      )}

      {/* TTS Floating Player Bar */}
      {showTTSPlayer && ttsAudio && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <TTSPlayer
            audioData={ttsAudio}
            sentences={ttsSentences}
            onClose={handleCloseTTSPlayer}
            onWordIndexChange={setTtsCurrentWordIndex}
            compact={true}
          />
        </div>
      )}
    </div>
  );
}
