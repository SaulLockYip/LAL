import { useState, useEffect, Fragment } from 'react';
import { Search, Filter, ArrowUpDown, BookOpen, ChevronDown, ChevronRight, History } from 'lucide-react';
import { getWords, getArticles, Word, Article } from '../services/api';

export function WordListPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [articleFilter, setArticleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'alphabetical'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadWords();
    loadArticles();
  }, [search, articleFilter, sortBy, sortOrder]);

  async function loadWords() {
    try {
      setLoading(true);
      setError(null);
      const params: Parameters<typeof getWords>[0] = {
        sortBy,
        sortOrder,
      };
      if (search) params.search = search;
      if (articleFilter) params.articleId = articleFilter;
      const data = await getWords(params);
      setWords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load words');
    } finally {
      setLoading(false);
    }
  }

  async function loadArticles() {
    try {
      const data = await getArticles();
      setArticles(data);
    } catch (err) {
      console.error('Failed to load articles:', err);
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
    });
  }

  function toggleRowExpansion(wordId: number) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(wordId)) {
      newExpanded.delete(wordId);
    } else {
      newExpanded.add(wordId);
    }
    setExpandedRows(newExpanded);
  }

  function parseInflections(inflections: Record<string, string> | null): string {
    if (!inflections || Object.keys(inflections).length === 0) return 'None';
    return Object.entries(inflections)
      .map(([form, value]) => `${form}: ${value}`)
      .join(', ');
  }

  function formatArrayField(arr: string[] | null | undefined): string {
    if (!arr || arr.length === 0) return 'None';
    return arr.join(', ');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Word List</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your saved vocabulary words
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search words..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Article Filter */}
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={articleFilter}
              onChange={(e) => setArticleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Articles</option>
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={20} className="text-gray-400" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(by);
                setSortOrder(order);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="alphabetical-asc">A-Z</option>
              <option value="alphabetical-desc">Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadWords}
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

      {/* Words List */}
      {!loading && !error && (
        <>
          {words.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p>No words saved yet</p>
              <p className="text-sm">Start reading articles and save words you want to learn</p>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Word
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Part of Speech
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Phonetic
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Definition
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Translation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Field
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Article
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date Added
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {words.map((word) => (
                    <Fragment key={word.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleRowExpansion(word.id)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            {expandedRows.has(word.id) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium">{word.word}</span>
                        </td>
                        <td className="px-4 py-4">
                          {word.partOfSpeech && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                              {word.partOfSpeech}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {word.phonetic || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs">
                            {word.definition}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs">
                            {word.translation || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {word.field || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                            {getArticleTitle(word.articleId)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(word.createdAt)}
                        </td>
                      </tr>
                      {expandedRows.has(word.id) && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                              {/* Example Sentence */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Example</h5>
                                <p className="text-sm italic text-gray-600 dark:text-gray-300">
                                  {word.exampleSentence || 'None'}
                                </p>
                              </div>

                              {/* Inflections */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Inflections</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {parseInflections(word.inflections)}
                                </p>
                              </div>

                              {/* Synonyms */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Synonyms</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {formatArrayField(word.synonyms)}
                                </p>
                              </div>

                              {/* Phrases */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase">Phrases</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {formatArrayField(word.phrases)}
                                </p>
                              </div>

                              {/* Derivation */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase flex items-center gap-1">
                                  <BookOpen size={12} /> Derivation
                                </h5>
                                {word.derivation ? (
                                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                    {word.derivation.prefix && (
                                      <p><span className="font-medium">Prefix:</span> {word.derivation.prefix} ({word.derivation.prefixMeaning})</p>
                                    )}
                                    {word.derivation.root && (
                                      <p><span className="font-medium">Root:</span> {word.derivation.root} (PID: {word.derivation.rootPid}) - {word.derivation.rootMeaning}</p>
                                    )}
                                    {word.derivation.suffix && (
                                      <p><span className="font-medium">Suffix:</span> {word.derivation.suffix} ({word.derivation.suffixMeaning})</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                                )}
                              </div>

                              {/* Etymology */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase flex items-center gap-1">
                                  <History size={12} /> Etymology
                                </h5>
                                {word.etymology ? (
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <p>{word.etymology.explanation}</p>
                                    {word.etymology.explanationTranslation && (
                                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                                        {word.etymology.explanationTranslation}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
