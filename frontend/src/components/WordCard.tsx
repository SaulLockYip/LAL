import { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown, BookOpen, History, Volume2, Quote, RefreshCw } from 'lucide-react';
import { WordLookupResult, DerivationEtymologyResult, Word } from '../services/api';

interface UserInfo {
  targetLanguage: string;
  nativeLanguage: string;
  currentLevel: string;
  voice: string | null;
}

interface WordCardProps {
  wordData: WordLookupResult | null;
  savedWord: Word | null;
  position: { x: number; y: number };
  onClose: () => void;
  onAddToWordList: () => void;
  onGetDerivation: () => void;
  onGetEtymology: () => void;
  isLoadingDerivation?: boolean;
  isLoadingEtymology?: boolean;
  isLoadingWord?: boolean;
  derivationData?: DerivationEtymologyResult | null;
  etymologyData?: DerivationEtymologyResult | null;
  userInfo?: UserInfo;
}

export function WordCard({
  wordData,
  savedWord,
  position: _position,
  onClose,
  onAddToWordList,
  onGetDerivation,
  onGetEtymology,
  isLoadingDerivation,
  isLoadingEtymology,
  isLoadingWord,
  derivationData,
  etymologyData,
  userInfo,
}: WordCardProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeakingExample, setIsSpeakingExample] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savedWord) {
      setShowTranslation(false);
    }
  }, [savedWord?.id]);

  // Map target language to speech language code
  const getSpeechLang = (language: string): string => {
    const langMap: Record<string, string> = {
      'English': 'en-US',
      'Chinese': 'zh-CN',
      'Japanese': 'ja-JP',
      'Korean': 'ko-KR',
      'French': 'fr-FR',
      'German': 'de-DE',
      'Spanish': 'es-ES',
      'Italian': 'it-IT',
      'Portuguese': 'pt-BR',
      'Russian': 'ru-RU',
      'Arabic': 'ar-SA',
      'Hindi': 'hi-IN',
    };
    return langMap[language] || 'en-US';
  };

  const handleSpeak = () => {
    const wordToSpeak = savedWord?.word || wordData?.word;
    if (!wordToSpeak) return;

    // Use Web Speech API
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(wordToSpeak);
      const lang = userInfo?.targetLanguage ? getSpeechLang(userInfo.targetLanguage) : 'en-US';
      utterance.lang = lang;
      utterance.rate = 0.9;

      // Try to use the saved voice
      if (userInfo?.voice) {
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === userInfo.voice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    }
  };

  const handleSpeakExample = () => {
    const exampleToSpeak = savedWord?.exampleSentence || wordData?.exampleSentence;
    if (!exampleToSpeak) return;

    // Use Web Speech API
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(exampleToSpeak);
      const lang = userInfo?.targetLanguage ? getSpeechLang(userInfo.targetLanguage) : 'en-US';
      utterance.lang = lang;
      utterance.rate = 0.85;

      // Try to use the saved voice
      if (userInfo?.voice) {
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === userInfo.voice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onstart = () => setIsSpeakingExample(true);
      utterance.onend = () => setIsSpeakingExample(false);
      utterance.onerror = () => setIsSpeakingExample(false);

      speechSynthesis.speak(utterance);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = () => {
      if (!isDragging) return;
      onClose();
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

  if (!wordData && !savedWord && !isLoadingWord) return null;

  // Show loading state
  if (isLoadingWord && !wordData && !savedWord) {
    return (
      <div
        ref={cardRef}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[500px] max-w-[90vw] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50"
        style={{ cursor: 'wait' }}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-end p-3 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Looking up word...</p>
        </div>
      </div>
    );
  }

  const displayWord = savedWord || wordData;
  if (!displayWord) return null;

  const partOfSpeech = displayWord.partOfSpeech;

  return (
    <div
      ref={cardRef}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[500px] max-w-[90vw] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{savedWord?.word || wordData?.word}</h3>
          {displayWord.phonetic && (
            <span className="text-gray-500 dark:text-gray-400">{displayWord.phonetic}</span>
          )}
          {partOfSpeech && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
              {partOfSpeech}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSpeak}
            disabled={isSpeaking}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            title="Listen to pronunciation"
          >
            <Volume2 size={20} className={isSpeaking ? 'text-blue-500 animate-pulse' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {/* Definition */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Definition</h4>
          <p>{savedWord?.definition || wordData?.definition}</p>
        </div>

        {/* Translation */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Translation</h4>
          {showTranslation ? (
            <p>{savedWord?.translation || wordData?.translation}</p>
          ) : (
            <button
              onClick={() => setShowTranslation(true)}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              Click to show translation
            </button>
          )}
        </div>

        {/* Example Sentence */}
        {(savedWord?.exampleSentence || wordData?.exampleSentence) && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Example</h4>
            <div className="flex items-start gap-2">
              <Quote size={14} className="mt-1 text-gray-400 flex-shrink-0" />
              <p className="italic text-gray-600 dark:text-gray-300 flex-1">
                "{savedWord?.exampleSentence || wordData?.exampleSentence}"
              </p>
              <button
                onClick={handleSpeakExample}
                disabled={isSpeakingExample}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 flex-shrink-0"
                title="Listen to example sentence"
              >
                <Volume2 size={16} className={isSpeakingExample ? 'text-blue-500 animate-pulse' : 'text-gray-500'} />
              </button>
            </div>
          </div>
        )}

        {/* Inflections */}
        {(() => {
          const inflections = savedWord?.inflections || wordData?.inflections;
          const parsedInflections = typeof inflections === 'string' ? JSON.parse(inflections) : inflections;
          return parsedInflections && Object.keys(parsedInflections).length > 0 ? (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Inflections</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parsedInflections).map(([form, value]) => (
                  <span key={form} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700">
                    {form}: {String(value)}
                  </span>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Synonyms */}
        {(() => {
          const synonyms = savedWord?.synonyms || wordData?.synonyms;
          const parsedSynonyms = typeof synonyms === 'string' ? JSON.parse(synonyms) : synonyms;
          return parsedSynonyms && parsedSynonyms.length > 0 ? (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Synonyms</h4>
              <div className="flex flex-wrap gap-2">
                {parsedSynonyms.map((syn: string) => (
                  <span key={syn} className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Phrases */}
        {(() => {
          const phrases = savedWord?.phrases || wordData?.phrases;
          const parsedPhrases = typeof phrases === 'string' ? JSON.parse(phrases) : phrases;
          return parsedPhrases && parsedPhrases.length > 0 ? (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Phrases</h4>
              <ul className="list-disc list-inside text-sm">
                {parsedPhrases.map((phrase: string) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            </div>
          ) : null;
        })()}

        {/* Derivation (on-demand) */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
            <BookOpen size={14} />
            Derivation
          </h4>
          {(isLoadingDerivation || (!derivationData && !savedWord?.derivation)) ? (
            <button
              onClick={onGetDerivation}
              disabled={isLoadingDerivation}
              className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1"
            >
              {isLoadingDerivation ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Show derivation analysis
                </>
              )}
            </button>
          ) : derivationData?.derivation ? (
            <div className="space-y-1">
              <div className="text-sm space-y-1">
                {derivationData.derivation.prefix && (
                  <p><span className="font-medium">Prefix:</span> {derivationData.derivation.prefix} ({derivationData.derivation.prefixMeaning})</p>
                )}
                {derivationData.derivation.root && (
                  <p><span className="font-medium">Root:</span> {derivationData.derivation.root} ({derivationData.derivation.rootMeaning})</p>
                )}
                {derivationData.derivation.suffix && (
                  <p><span className="font-medium">Suffix:</span> {derivationData.derivation.suffix} ({derivationData.derivation.suffixMeaning})</p>
                )}
              </div>
              {!savedWord && (
                <button
                  onClick={onGetDerivation}
                  disabled={isLoadingDerivation}
                  className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1 mt-1"
                >
                  {isLoadingDerivation ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                      Regenerate
                    </>
                  )}
                </button>
              )}
            </div>
          ) : savedWord?.derivation ? (
            <div className="text-sm space-y-1">
              {savedWord.derivation.prefix && (
                <p><span className="font-medium">Prefix:</span> {savedWord.derivation.prefix} ({savedWord.derivation.prefixMeaning})</p>
              )}
              {savedWord.derivation.root && (
                <p><span className="font-medium">Root:</span> {savedWord.derivation.root} ({savedWord.derivation.rootMeaning})</p>
              )}
              {savedWord.derivation.suffix && (
                <p><span className="font-medium">Suffix:</span> {savedWord.derivation.suffix} ({savedWord.derivation.suffixMeaning})</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Etymology (on-demand) */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
            <History size={14} />
            Etymology
          </h4>
          {(isLoadingEtymology || (!etymologyData && !savedWord?.etymology)) ? (
            <button
              onClick={onGetEtymology}
              disabled={isLoadingEtymology}
              className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1"
            >
              {isLoadingEtymology ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Show etymology
                </>
              )}
            </button>
          ) : etymologyData?.etymology ? (
            <div className="space-y-1">
              <div className="text-sm">
                <p>{etymologyData.etymology.explanation}</p>
                {etymologyData.etymology.explanationTranslation && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {etymologyData.etymology.explanationTranslation}
                  </p>
                )}
              </div>
              {!savedWord && (
                <button
                  onClick={onGetEtymology}
                  disabled={isLoadingEtymology}
                  className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1 mt-1"
                >
                  {isLoadingEtymology ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                      Regenerate
                    </>
                  )}
                </button>
              )}
            </div>
          ) : savedWord?.etymology ? (
            <div className="text-sm">
              <p>{savedWord.etymology.explanation}</p>
              {savedWord.etymology.explanationTranslation && (
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  {savedWord.etymology.explanationTranslation}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      {!savedWord && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button
            onClick={onAddToWordList}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Add to Word List
          </button>
        </div>
      )}
      {savedWord && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Already in your word list
          </p>
        </div>
      )}
    </div>
  );
}
