import { useState, useEffect } from 'react';
import { Filter, ArrowUpDown, PenTool, Calendar, Clock, CheckCircle, HelpCircle, ChevronDown, ChevronRight, BookOpen, Trash2 } from 'lucide-react';
import { getArticles, deleteAllExercises, Article, Exercise } from '../services/api';

interface ArticleExerciseGroup {
  articleId: string;
  articleTitle: string;
  exercises: Exercise[];
  exerciseCount: number;
  completedCount: number;
  pendingCount: number;
}

export function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articleFilter, setArticleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExercises();
    loadArticles();
  }, [articleFilter, statusFilter, sortBy, sortOrder]);

  async function loadExercises() {
    try {
      setLoading(true);
      setError(null);
      // Fetch all exercises from the API
      const response = await fetch('/api/exercises');
      const data = await response.json();
      if (data.success) {
        let filtered = data.data;

        // Apply article filter
        if (articleFilter) {
          filtered = filtered.filter((e: Exercise) => e.articleId === articleFilter);
        }

        // Apply status filter
        if (statusFilter) {
          filtered = filtered.filter((e: Exercise) => e.status === statusFilter);
        }

        // Sort
        filtered.sort((a: Exercise, b: Exercise) => {
          if (sortBy === 'date') {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          } else {
            const scoreA = a.score || 0;
            const scoreB = b.score || 0;
            return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
          }
        });

        setExercises(filtered);
      } else {
        throw new Error(data.error?.message || 'Failed to load exercises');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400">
            <HelpCircle size={12} />
            Not Started
          </span>
        );
      case 'submitted':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            <Clock size={12} />
            Submitted
          </span>
        );
      case 'graded':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
            <CheckCircle size={12} />
            Completed
          </span>
        );
      default:
        return null;
    }
  }

  function getScoreColor(score: number | null) {
    if (score === null) return 'text-gray-600 dark:text-gray-400';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  function getBandScoreColor(band: number | null) {
    if (band === null) return 'text-gray-600 dark:text-gray-400';
    if (band >= 7) return 'text-green-600 dark:text-green-400';
    if (band >= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  // Group exercises by article
  function getGroupedExercises(): ArticleExerciseGroup[] {
    const groups: Map<string, ArticleExerciseGroup> = new Map();

    exercises.forEach((exercise) => {
      if (!groups.has(exercise.articleId)) {
        groups.set(exercise.articleId, {
          articleId: exercise.articleId,
          articleTitle: getArticleTitle(exercise.articleId),
          exercises: [],
          exerciseCount: 0,
          completedCount: 0,
          pendingCount: 0,
        });
      }
      const group = groups.get(exercise.articleId)!;
      group.exercises.push(exercise);
      group.exerciseCount++;
      if (exercise.status === 'graded') {
        group.completedCount++;
      } else if (exercise.status === 'pending') {
        group.pendingCount++;
      }
    });

    return Array.from(groups.values());
  }

  function toggleArticleExpanded(articleId: string) {
    setExpandedArticles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  }

  async function handleDeleteAllExercises(e: React.MouseEvent, articleId: string) {
    e.stopPropagation();
    if (!confirm('Delete all exercises for this article? This cannot be undone.')) return;
    try {
      await deleteAllExercises(articleId);
      setExercises((prev) => prev.filter((ex) => ex.articleId !== articleId));
    } catch (err) {
      console.error('Failed to delete all exercises:', err);
    }
  }

  const groupedExercises = getGroupedExercises();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Exercises</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and track your exercise history, organized by article
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
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

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Not Started</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Completed</option>
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
              <option value="score-desc">Highest Score</option>
              <option value="score-asc">Lowest Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadExercises}
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

      {/* Exercises List Grouped by Article */}
      {!loading && !error && (
        <>
          {exercises.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <PenTool size={48} className="mx-auto mb-4 opacity-50" />
              <p>No exercises found</p>
              <p className="text-sm">Generate exercises from articles to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedExercises.map((group) => (
                <div
                  key={group.articleId}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Article Header - Clickable to expand/collapse */}
                  <button
                    onClick={() => toggleArticleExpanded(group.articleId)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50">
                        <BookOpen size={20} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{group.articleTitle}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {group.exerciseCount} {group.exerciseCount === 1 ? 'exercise' : 'exercises'}
                          {group.completedCount > 0 && (
                            <span className="ml-2 text-green-600 dark:text-green-400">
                              ({group.completedCount} completed)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Status summary badges */}
                      <div className="flex items-center gap-2">
                        {group.pendingCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400">
                            <HelpCircle size={12} />
                            {group.pendingCount} Not Started
                          </span>
                        )}
                        {group.exercises.some((e) => e.status === 'submitted') && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                            <Clock size={12} />
                            {group.exercises.filter((e) => e.status === 'submitted').length} Submitted
                          </span>
                        )}
                        {group.completedCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
                            <CheckCircle size={12} />
                            {group.completedCount} Completed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteAllExercises(e, group.articleId)}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 hover:text-red-600 transition-colors"
                        title="Delete all exercises for this article"
                      >
                        <Trash2 size={16} />
                      </button>
                      {expandedArticles.has(group.articleId) ? (
                        <ChevronDown size={20} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={20} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Exercise List */}
                  {expandedArticles.has(group.articleId) && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <div className="p-4 space-y-3">
                        {group.exercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="flex items-start justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-medium">Exercise #{exercise.id}</span>
                                {getStatusBadge(exercise.status)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {(() => {
                                  const qc = exercise.questionContent;
                                  if (typeof qc === 'string') return qc.replace(/<!--BOX-->/g, '______');
                                  if ('text' in qc && typeof qc.text === 'string') return qc.text;
                                  return JSON.stringify(qc) || 'No question content';
                                })()}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  {formatDate(exercise.createdAt)}
                                </div>
                                {/* Show exercise type badge */}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  exercise.type === 'choice' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600' :
                                  exercise.type === 'fill_blank' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' :
                                  exercise.type === 'open_ended' ? 'bg-green-100 dark:bg-green-900/50 text-green-600' :
                                  exercise.type === 'translation' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600' :
                                  exercise.type === 'word_explanation' ? 'bg-pink-100 dark:bg-pink-900/50 text-pink-600' :
                                  exercise.type === 'sentence_imitation' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-600'
                                }`}>
                                  {exercise.type.replace('_', ' ')}
                                </span>
                                {exercise.status === 'graded' && exercise.score !== null && (
                                  <span className={`font-medium ${getScoreColor(exercise.score)}`}>
                                    Score: {exercise.score}/100
                                  </span>
                                )}
                                {exercise.status === 'graded' && exercise.bandScore !== null && (
                                  <span className={`font-medium ${getBandScoreColor(exercise.bandScore)}`}>
                                    Band: {exercise.bandScore}/9
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {exercise.status === 'graded' && exercise.bandScore !== null && (
                                <span className={`text-2xl font-bold ${getBandScoreColor(exercise.bandScore)}`}>
                                  {exercise.bandScore}
                                </span>
                              )}
                              {exercise.status === 'graded' && exercise.score !== null && exercise.bandScore === null && (
                                <span className={`text-2xl font-bold ${getScoreColor(exercise.score)}`}>
                                  {exercise.score}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
