import { useState, useEffect } from 'react';
import { Save, Loader2, Sun, Moon, Wifi, Volume2 } from 'lucide-react';
import { getUser, updateUser, getAISettings, updateAISettings, testAISettings, getTTSVoices, TTSVoice } from '../services/api';
import { useTheme } from '../components/ThemeProvider';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LANGUAGES = [
  'English',
  'Chinese',
  'Japanese',
  'Korean',
  'French',
  'German',
  'Spanish',
  'Italian',
  'Portuguese',
  'Russian',
  'Arabic',
  'Hindi',
  'Other',
];

// Voice data type
interface Voice {
  name: string;
  lang: string;
  displayName: string;
}

// Map language names to voice language codes
const LANGUAGE_VOICE_MAP: Record<string, string[]> = {
  'English': ['en_US', 'en_GB', 'en_AU', 'en_IN'],
  'Chinese': ['zh_CN', 'zh_TW'],
  'Japanese': ['ja_JP'],
  'Korean': ['ko_KR'],
  'French': ['fr_FR', 'fr_CA'],
  'German': ['de_DE'],
  'Spanish': ['es_ES', 'es_MX'],
  'Italian': ['it_IT'],
  'Portuguese': ['pt_BR', 'pt_PT'],
  'Russian': ['ru_RU'],
  'Arabic': ['ar_001'],
  'Hindi': ['hi_IN'],
  'Other': [],
};

// TTS Emotion options
const EMOTIONS = ['', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];

// TTS Sound Effects options
const SOUND_EFFECTS = ['', 'spacious_echo', 'auditorium_echo', 'lofi_telephone', 'robotic'];

// Audio Sample Rate options
const AUDIO_SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100];

// Bitrate options
const BITRATES = [32000, 64000, 128000, 256000];

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  // User state
  const [userName, setUserName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');

  // AI Settings state
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Voice state
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [userSaved, setUserSaved] = useState(false);
  const [aiSaved, setAISaved] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TTS Settings state
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsVoiceId, setTtsVoiceId] = useState('Chinese (Mandarin)_Reliable_Executive');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsVol, setTtsVol] = useState(10);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [ttsEmotion, setTtsEmotion] = useState('');
  const [ttsAudioSampleRate, setTtsAudioSampleRate] = useState(32000);
  const [ttsBitrate, setTtsBitrate] = useState(128000);
  const [ttsChannel, setTtsChannel] = useState(1);
  const [ttsSoundEffects, setTtsSoundEffects] = useState('');

  // TTS API state
  const [testingTTS, setTestingTTS] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // MiniMax TTS Voices
  const [miniMaxVoices, setMiniMaxVoices] = useState<TTSVoice[]>([]);
  const [loadingMiniMaxVoices, setLoadingMiniMaxVoices] = useState(false);
  const [savingTTS, setSavingTTS] = useState(false);
  const [ttsSaved, setTtsSaved] = useState(false);

  // Load available voices from macOS
  useEffect(() => {
    async function loadVoices() {
      setLoadingVoices(true);
      try {
        const response = await fetch('/api/settings/voices');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setAvailableVoices(data.data);
          }
        } else {
          // Fallback: voices will be loaded empty, user can still use default
          console.warn('Could not load voices from server');
        }
      } catch (err) {
        console.warn('Error loading voices:', err);
      } finally {
        setLoadingVoices(false);
      }
    }
    loadVoices();
  }, []);

  // Filter voices when target language changes
  useEffect(() => {
    if (!targetLanguage) {
      setFilteredVoices([]);
      return;
    }

    const langCodes = LANGUAGE_VOICE_MAP[targetLanguage] || [];
    if (langCodes.length === 0) {
      setFilteredVoices([]);
      return;
    }

    const filtered = availableVoices.filter(voice =>
      langCodes.some(code => voice.lang.startsWith(code.split('_')[0]))
    );
    setFilteredVoices(filtered);
  }, [targetLanguage, availableVoices]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);

      const [userData, aiData] = await Promise.all([
        getUser(),
        getAISettings(),
      ]);

      setUserName(userData.name || '');
      setNativeLanguage(userData.nativeLanguage || '');
      setTargetLanguage(userData.targetLanguage || '');
      setCurrentLevel(userData.currentLevel || '');
      setSelectedVoice(userData.voice || '');

      setProvider(aiData?.provider || 'openai');
      setModelName(aiData?.modelName || '');
      setApiKey(aiData?.apiKey || '');
      setBaseUrl(aiData?.baseUrl || '');

      // Load TTS settings
      setTtsApiKey(userData.ttsApiKey || '');
      setTtsVoiceId(userData.ttsVoiceId || 'Chinese (Mandarin)_Reliable_Executive');
      setTtsSpeed(userData.ttsSpeed ?? 1.0);
      setTtsVol(userData.ttsVol ?? 10);
      setTtsPitch(userData.ttsPitch ?? 0);
      setTtsEmotion(userData.ttsEmotion || '');
      setTtsAudioSampleRate(userData.ttsAudioSampleRate ?? 32000);
      setTtsBitrate(userData.ttsBitrate ?? 128000);
      setTtsChannel(userData.ttsChannel ?? 1);
      setTtsSoundEffects(userData.ttsSoundEffects || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    setUserSaved(false);
    try {
      await updateUser({
        name: userName,
        nativeLanguage,
        targetLanguage,
        currentLevel,
        voice: selectedVoice,
      });
      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user settings');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleTestVoice() {
    if (!selectedVoice) return;
    setTestingVoice(true);
    try {
      // Use Web Speech API to test voice
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Hello, this is a test.');
        // Find the voice by name
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) {
          utterance.voice = voice;
        }
        utterance.lang = targetLanguage === 'Chinese' ? 'zh-CN' :
                        targetLanguage === 'Japanese' ? 'ja-JP' :
                        targetLanguage === 'Korean' ? 'ko-KR' :
                        targetLanguage === 'German' ? 'de-DE' :
                        targetLanguage === 'French' ? 'fr-FR' :
                        targetLanguage === 'Spanish' ? 'es-ES' :
                        targetLanguage === 'Italian' ? 'it-IT' :
                        targetLanguage === 'Portuguese' ? 'pt-BR' :
                        'en-US';
        speechSynthesis.speak(utterance);
      }
    } finally {
      setTestingVoice(false);
    }
  }

  async function handleSaveAI(e: React.FormEvent) {
    e.preventDefault();
    setSavingAI(true);
    setAISaved(false);
    try {
      await updateAISettings({
        provider,
        modelName,
        apiKey,
        baseUrl,
      });
      setAISaved(true);
      setTimeout(() => setAISaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings');
    } finally {
      setSavingAI(false);
    }
  }

  async function handleTestAI() {
    if (!modelName || !apiKey || !baseUrl) {
      setTestResult({ success: false, message: 'Please fill in all AI settings first' });
      return;
    }
    setTestingAI(true);
    setTestResult(null);
    try {
      const result = await testAISettings({ provider, modelName, apiKey, baseUrl });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingAI(false);
    }
  }

  async function handleLoadMiniMaxVoices() {
    setLoadingMiniMaxVoices(true);
    try {
      const voices = await getTTSVoices(targetLanguage);
      setMiniMaxVoices(voices);
    } catch (err) {
      console.error('Failed to load MiniMax voices:', err);
    } finally {
      setLoadingMiniMaxVoices(false);
    }
  }

  async function handleSaveTTS(e: React.FormEvent) {
    e.preventDefault();
    setSavingTTS(true);
    setTtsSaved(false);
    try {
      await updateUser({
        ttsApiKey: ttsApiKey || null,
        ttsVoiceId,
        ttsSpeed,
        ttsVol,
        ttsPitch,
        ttsEmotion: ttsEmotion || null,
        ttsAudioSampleRate,
        ttsBitrate,
        ttsChannel,
        ttsSoundEffects: ttsSoundEffects || null,
      });
      setTtsSaved(true);
      setTimeout(() => setTtsSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save TTS settings');
    } finally {
      setSavingTTS(false);
    }
  }

  async function handleTestTTS() {
    if (!ttsApiKey) {
      setTtsTestResult({ success: false, message: 'Please enter a TTS API key first' });
      return;
    }
    setTestingTTS(true);
    setTtsTestResult(null);
    try {
      // Test by trying to get voices
      const voices = await getTTSVoices(targetLanguage);
      if (voices && voices.length > 0) {
        setTtsTestResult({ success: true, message: 'Connection successful! Found ' + voices.length + ' voices.' });
      } else {
        setTtsTestResult({ success: false, message: 'Connected but no voices available for selected language.' });
      }
    } catch (err) {
      setTtsTestResult({ success: false, message: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setTestingTTS(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your profile and AI settings
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadSettings}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Theme Toggle */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Switch between light and dark mode
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {theme === 'light' ? (
                <>
                  <Moon size={20} />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun size={20} />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Profile */}
        <form onSubmit={handleSaveUser}>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">User Profile</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Native Language */}
              <div>
                <label className="block text-sm font-medium mb-2">Native Language</label>
                <select
                  value={nativeLanguage}
                  onChange={(e) => setNativeLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Language */}
              <div>
                <label className="block text-sm font-medium mb-2">Target Language</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <span className="flex items-center gap-2">
                    <Volume2 size={14} />
                    TTS Voice (macOS)
                  </span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    disabled={loadingVoices || filteredVoices.length === 0}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingVoices ? 'Loading voices...' :
                       filteredVoices.length === 0 && targetLanguage ?
                       'No voices for this language' : 'Default voice'}
                    </option>
                    {filteredVoices.map((voice) => (
                      <option key={`${voice.name}|${voice.lang}`} value={voice.name}>
                        {voice.displayName} ({voice.lang})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    disabled={!selectedVoice || testingVoice}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                    title="Test voice"
                  >
                    {testingVoice ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                </div>
                {targetLanguage && filteredVoices.length === 0 && !loadingVoices && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    No macOS voices found for {targetLanguage}. Using default.
                  </p>
                )}
              </div>

              {/* Current Level */}
              <div>
                <label className="block text-sm font-medium mb-2">Current Level</label>
                <select
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select level</option>
                  {CEFR_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      CEFR {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="submit"
                disabled={savingUser}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {savingUser ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Save Profile
              </button>
              {userSaved && (
                <span className="text-green-600 dark:text-green-400 text-sm">
                  Profile saved successfully!
                </span>
              )}
            </div>
          </div>
        </form>

        {/* AI Settings */}
        <form onSubmit={handleSaveAI}>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">AI Settings</h2>

            <div className="space-y-6">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium mb-2">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic Compatible</option>
                </select>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-2">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  For OpenAI: https://api.openai.com/v1<br />
                  For Anthropic: https://api.anthropic.com<br />
                  Or your custom endpoint
                </p>
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Model Name</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20240620'}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={handleTestAI}
                disabled={testingAI}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {testingAI ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Wifi size={18} />
                )}
                Test Connection
              </button>
              <button
                type="submit"
                disabled={savingAI}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {savingAI ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Save AI Settings
              </button>
              {aiSaved && (
                <span className="text-green-600 dark:text-green-400 text-sm">
                  AI settings saved successfully!
                </span>
              )}
            </div>
            {testResult && (
              <div className={`mt-4 p-3 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <p className={testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        </form>

        {/* TTS Settings */}
        <form onSubmit={handleSaveTTS}>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">TTS Settings (MiniMax)</h2>

            <div className="space-y-6">
              {/* TTS API Key */}
              <div>
                <label className="block text-sm font-medium mb-2">TTS API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={ttsApiKey}
                    onChange={(e) => setTtsApiKey(e.target.value)}
                    placeholder="Enter your MiniMax TTS API key"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestTTS}
                    disabled={testingTTS}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {testingTTS ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Wifi size={18} />
                    )}
                    Test Connection
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  MiniMax API key for text-to-speech. Uses the LLM API key if not set.
                </p>
                {ttsTestResult && (
                  <div className={`mt-2 p-2 rounded-lg text-sm ${ttsTestResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                    {ttsTestResult.message}
                  </div>
                )}
              </div>

              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Voice Selection</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleLoadMiniMaxVoices}
                    disabled={loadingMiniMaxVoices || !targetLanguage}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {loadingMiniMaxVoices ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      'Load Voices'
                    )}
                  </button>
                  <select
                    value={ttsVoiceId}
                    onChange={(e) => setTtsVoiceId(e.target.value)}
                    disabled={miniMaxVoices.length === 0}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">
                      {miniMaxVoices.length === 0 ? 'Load voices first' : 'Select a voice'}
                    </option>
                    {miniMaxVoices.map((voice) => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.voice_name} - {voice.description?.[0] || 'No description'}
                      </option>
                    ))}
                  </select>
                </div>
                {!targetLanguage && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Please select a target language first
                  </p>
                )}
              </div>

              {/* Speed Slider */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Speed: {ttsSpeed.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0.5</span>
                  <span>1.0</span>
                  <span>2.0</span>
                </div>
              </div>

              {/* Volume Slider */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Volume: {ttsVol.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={ttsVol}
                  onChange={(e) => setTtsVol(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              {/* Pitch Slider */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Pitch: {ttsPitch}
                </label>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={ttsPitch}
                  onChange={(e) => setTtsPitch(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>-12</span>
                  <span>0</span>
                  <span>12</span>
                </div>
              </div>

              {/* Emotion Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2">Emotion</label>
                <select
                  value={ttsEmotion}
                  onChange={(e) => setTtsEmotion(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {EMOTIONS.filter(e => e !== '').map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audio Sample Rate Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2">Audio Sample Rate</label>
                <select
                  value={ttsAudioSampleRate}
                  onChange={(e) => setTtsAudioSampleRate(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {AUDIO_SAMPLE_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} Hz
                    </option>
                  ))}
                </select>
              </div>

              {/* Bitrate Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2">Bitrate</label>
                <select
                  value={ttsBitrate}
                  onChange={(e) => setTtsBitrate(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BITRATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} bps
                    </option>
                  ))}
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium mb-2">Channel</label>
                <select
                  value={ttsChannel}
                  onChange={(e) => setTtsChannel(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Mono (1)</option>
                  <option value={2}>Stereo (2)</option>
                </select>
              </div>

              {/* Sound Effects */}
              <div>
                <label className="block text-sm font-medium mb-2">Sound Effects</label>
                <select
                  value={ttsSoundEffects}
                  onChange={(e) => setTtsSoundEffects(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {SOUND_EFFECTS.filter(e => e !== '').map((effect) => (
                    <option key={effect} value={effect}>
                      {effect.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="submit"
                disabled={savingTTS}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {savingTTS ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Save TTS Settings
              </button>
              {ttsSaved && (
                <span className="text-green-600 dark:text-green-400 text-sm">
                  TTS settings saved successfully!
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
