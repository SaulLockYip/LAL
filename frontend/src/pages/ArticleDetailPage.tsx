import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, Play, Send, GripVertical, List, Bot, Volume2, Trash2 } from 'lucide-react';
import { getArticle, getWords, createWord, deleteWord, generateExercise, submitExercise, getExercises, Article, Word, WordLookupResult, DerivationEtymologyResult, getTTS, Exercise } from '../services/api';
import { LLMChat } from '../components/LLMChat';
import { WordCard } from '../components/WordCard';

const PENDING_LOOKUP_PREFIX = 'pending_word_lookup_';
const PENDING_LOOKUP_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<number, string>>({});
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [exerciseResults, setExerciseResults] = useState<any | null>(null);

  // TTS state
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);

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
    } else {
      setSavedWord(null);
      // Check for pending lookup in localStorage
      const pendingData = loadPendingLookup(word);
      if (pendingData) {
        setWordData(pendingData.wordData);
        setDerivationData(pendingData.derivationData);
        setEtymologyData(pendingData.etymologyData);
        setIsLoadingWord(false);
      } else {
        setWordData(null);
        setDerivationData(null);
        setEtymologyData(null);
        setIsLoadingWord(true); // Show loading immediately
      }
    }

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

    try {
      // Decode article content (base64) - handle both single and double encoding
      let articleContent = article.content;
      try {
        const decoded = atob(articleContent);
        // If still looks like base64, decode again
        if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
          articleContent = atob(decoded);
        } else {
          articleContent = decoded;
        }
      } catch {
        // Content might not be base64 encoded
      }

      const response = await fetch('/api/words/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          articleId: id,
          articleContent,
          context,
          userInfo,
        }),
      });

      const data = await response.json();
      if (data.success) {
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
      console.error('Word lookup error:', err);
    } finally {
      setIsLoadingWord(false);
    }
  }

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
    try {
      const newExercise = await generateExercise(id);
      setExercise(newExercise);
    } catch (err) {
      console.error('Failed to generate exercise:', err);
    } finally {
      setIsGeneratingExercise(false);
    }
  }

  async function handleStartExercise() {
    setExerciseMode(true);
  }

  async function handleSubmitExercise() {
    if (!exercise || exercise.length === 0) return;

    setIsSubmittingExercise(true);
    try {
      const answers = Object.values(exerciseAnswers);
      // Use the first exercise's ID for grading (backend grades all exercises for the article)
      const results = await submitExercise(exercise[0].id, answers);
      setExercise(results.exercises);
      setExerciseResults(results);
    } catch (err) {
      console.error('Failed to submit exercise:', err);
    } finally {
      setIsSubmittingExercise(false);
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
    try {
      // Poll progress simulation
      const progressInterval = setInterval(() => {
        setTtsProgress(p => Math.min(p + 10, 90));
      }, 2000);

      const response = await fetch(`/api/articles/${id}/tts`, { method: 'POST' });
      const data = await response.json();

      clearInterval(progressInterval);
      setTtsProgress(100);

      if (data.success) {
        setTtsAudio(data.data.audioData);
      }
    } catch (err) {
      console.error('Failed to generate TTS:', err);
    } finally {
      setIsGeneratingTTS(false);
    }
  }

  function handlePlayTTS() {
    if (!ttsAudio) return;
    const audio = new Audio(`data:audio/mp3;base64,${ttsAudio}`);
    audio.play();
  }

  // Decode and render article content
  function renderArticleContent() {
    if (!article) return '';

    let content = article.content;
    // Handle both single and double base64 encoding (legacy data)
    try {
      const decoded = atob(content);
      // If the decoded content looks like base64 (only contains base64 chars), decode again
      if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
        content = atob(decoded);
      } else {
        content = decoded;
      }
    } catch (e) {
      // Content might not be base64 encoded at all
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
          className="overflow-y-auto p-8"
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
              {renderArticleContent()}
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
              <LLMChat
                articleId={id!}
                articleContent={(() => {
                  let content = article.content;
                  try {
                    const decoded = atob(content);
                    // Handle double encoding
                    if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
                      content = atob(decoded);
                    } else {
                      content = decoded;
                    }
                  } catch {}
                  return content;
                })()}
                wordList={words.map((w) => w.word)}
                userInfo={userInfo || undefined}
              />
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
                    <h3 className="text-3xl font-bold mb-2">
                      Score: {exerciseResults.grading?.totalScore}/100
                    </h3>
                    {exerciseResults.grading?.overallComment && (
                      <p className="text-gray-600 dark:text-gray-400">
                        {exerciseResults.grading.overallComment}
                      </p>
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
                          <span className="font-medium">Question {index + 1}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            result.correct
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                          }`}>
                            {result.correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <p className="text-sm mb-2">Your answer: {result.userAnswer}</p>
                        {result.comment && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
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
                          <p className="font-medium mb-3">
                            {ex.questionContent.replace(/<!--BOX-->/g, '______')}
                          </p>

                          {ex.options ? (
                            <div className="space-y-2">
                              {ex.options.map((option: string, optIndex: number) => (
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
                          ) : (
                            <input
                              type="text"
                              placeholder="Your answer..."
                              value={exerciseAnswers[index] || ''}
                              onChange={(e) => setExerciseAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
                              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

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
    </div>
  );
}
