import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, Calendar, Play, Trash2, FileText, Clock, AlertCircle } from 'lucide-react';
import { getAllTTS, deleteTTS, getArticles, TTSEntry, Article } from '../services/api';
import { TTSPlayer } from '../components/TTSPlayer';
import { Sentence } from '../services/tts';

export function TTSPage() {
  const [ttsEntries, setTtsEntries] = useState<TTSEntry[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [ttsData, articlesData] = await Promise.all([
        getAllTTS(),
        getArticles(),
      ]);
      setTtsEntries(ttsData);
      setArticles(articlesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TTS entries');
    } finally {
      setLoading(false);
    }
  }

  function getArticleTitle(articleId: string) {
    const article = articles.find((a) => a.id === articleId);
    return article?.title || 'Unknown Article';
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleDelete(e: React.MouseEvent, entryId: string) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this TTS entry? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteTTS(entryId);
      setTtsEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      if (playingEntryId === entryId) {
        setPlayingEntryId(null);
      }
    } catch (err) {
      console.error('Failed to delete TTS entry:', err);
      alert('Failed to delete TTS entry. Please try again.');
    }
  }

  function togglePlay(entryId: string) {
    if (playingEntryId === entryId) {
      setPlayingEntryId(null);
    } else {
      setPlayingEntryId(entryId);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">TTS Audio</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your generated text-to-speech audio files
          </p>
        </div>
        <Link
          to="/articles"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <FileText size={18} />
          Generate New
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* TTS Entries List */}
      {!loading && !error && (
        <>
          {ttsEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Volume2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>No TTS audio generated yet</p>
              <p className="text-sm">Go to Articles and generate TTS for an article</p>
              <Link
                to="/articles"
                className="mt-4 inline-flex items-center gap-2 text-blue-500 hover:text-blue-600"
              >
                <FileText size={16} />
                Browse Articles
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {ttsEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                            <Volume2 size={20} className="text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-lg truncate">
                              {getArticleTitle(entry.articleId)}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(entry.createdAt)}
                              </span>
                              {entry.sentenceData && entry.sentenceData.length > 0 ? (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <Clock size={14} />
                                  {entry.sentenceData.length} sentences (word sync)
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                  <AlertCircle size={14} />
                                  No sentence timing data
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => togglePlay(entry.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            playingEntryId === entry.id
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          <Play size={18} fill={playingEntryId === entry.id ? 'none' : 'currentColor'} />
                          {playingEntryId === entry.id ? 'Close' : 'Play'}
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, entry.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* TTS Player (shown when playing) */}
                    {playingEntryId === entry.id && (
                      <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                        <TTSPlayer
                          audioData={entry.audioData}
                          sentences={(entry.sentenceData as Sentence[]) || []}
                          onClose={() => setPlayingEntryId(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}