import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import {
  Sentence,
  calculateWordTimings,
  findCurrentWordIndex,
  formatTime,
} from '../services/tts';

interface TTSPlayerProps {
  audioData: string; // base64 encoded audio
  sentences: Sentence[]; // sentence timing data
  onClose?: () => void;
  onWordIndexChange?: (index: number) => void; // callback for word index changes
  compact?: boolean; // if true, renders as compact floating bar
}

export function TTSPlayer({ audioData, sentences, onClose, onWordIndexChange, compact = false }: TTSPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Memoize word timings to avoid recalculating on every render
  const words = useMemo(() => calculateWordTimings(sentences), [sentences]);

  // Use ref to track isDragging state without causing effect re-runs
  const isDraggingRef = useRef(isDragging);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Initialize audio
  useEffect(() => {
    if (!audioData) return;

    // Validate base64 data before creating audio
    if (audioData.length === 0) {
      setAudioError('Audio data is empty');
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
    audioRef.current = audio;
    setAudioError(null);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setAudioError(null);
    };

    const handleTimeUpdate = () => {
      // Use ref to get current isDragging value without stale closure
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
        setCurrentWordIndex(findCurrentWordIndex(words, audio.currentTime));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentWordIndex(-1);
    };

    const handleError = () => {
      const errorMsg = audio.error?.message || 'Unknown audio error';
      setAudioError(`Audio playback error: ${errorMsg}`);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', () => setIsPlaying(true));
      audio.removeEventListener('pause', () => setIsPlaying(false));
      audio.removeEventListener('error', handleError);
    };
  }, [audioData, words]);

  // Notify parent of word index changes
  useEffect(() => {
    onWordIndexChange?.(currentWordIndex);
  }, [currentWordIndex, onWordIndexChange]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  // Seek to position
  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(time);
    setCurrentWordIndex(findCurrentWordIndex(words, time));
  }, [duration, words]);

  // Handle progress bar click/drag
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  }, [duration, seekTo]);

  // Handle mouse down on progress bar (start dragging)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
  }, [handleProgressClick]);

  // Handle mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(percent * duration);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, seekTo]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    seekTo(currentTime + seconds);
  }, [currentTime, seekTo]);

  // Get highlight class for a word
  const getWordHighlightClass = useCallback((index: number) => {
    if (index === currentWordIndex) {
      return 'bg-yellow-400 dark:bg-yellow-500 text-black rounded px-0.5';
    }
    if (index < currentWordIndex) {
      return 'text-gray-500 dark:text-gray-400';
    }
    return '';
  }, [currentWordIndex]);

  // Render highlighted sentence text
  const renderHighlightedText = () => {
    const elements: React.ReactNode[] = [];
    let wordIndex = 0;

    sentences.forEach((sentence, sentenceIdx) => {
      const sentenceWords = sentence.text.split(/(\s+)/).filter(s => s.length > 0);

      sentenceWords.forEach((token, tokenIdx) => {
        if (/\s+/.test(token)) {
          // Whitespace
          elements.push(<span key={`ws-${sentenceIdx}-${tokenIdx}`}>{token}</span>);
        } else {
          // Word
          const highlightClass = getWordHighlightClass(wordIndex);
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
      if (sentenceIdx < sentences.length - 1) {
        elements.push(<br key={`br-${sentenceIdx}`} />);
        elements.push(<span key={`space-${sentenceIdx}`}>{' '}</span>);
      }
    });

    return elements;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Compact floating bar mode (for inline word highlighting)
  if (compact) {
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-lg">
        {/* Error display */}
        {audioError && (
          <div className="px-4 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs">
            {audioError}
          </div>
        )}

        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="h-1.5 bg-gray-200 dark:bg-gray-700 cursor-pointer group"
          onMouseDown={handleMouseDown}
        >
          <div
            className="h-full bg-blue-500 relative transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Compact Controls */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Volume2 size={18} className={audioError ? 'text-red-500' : 'text-blue-500'} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {audioError ? 'Error' : isPlaying ? 'Playing' : 'Paused'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => skip(-5)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Skip back 5 seconds"
            >
              <SkipBack size={16} className="text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center
                         text-white shadow-md transition-all hover:scale-105"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skip(5)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Skip forward 5 seconds"
            >
              <SkipForward size={16} className="text-gray-600 dark:text-gray-300" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="ml-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Close"
              >
                <span className="text-gray-500 dark:text-gray-400 text-lg leading-none">&times;</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full mode (original modal-like design)
  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
      {/* Error display */}
      {audioError && (
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
          {audioError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <Volume2 size={20} className={audioError ? 'text-red-500' : 'text-blue-500'} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Audio Playback</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {audioError ? 'Error' : isPlaying ? 'Playing...' : 'Paused'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="text-gray-500 dark:text-gray-400 text-xl leading-none">&times;</span>
          </button>
        )}
      </div>

      {/* Highlighted Text Display */}
      <div className="p-6 max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
        <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
          {renderHighlightedText()}
        </p>
      </div>

      {/* Progress Bar */}
      <div
        ref={progressRef}
        className="h-2 bg-gray-200 dark:bg-gray-700 cursor-pointer group"
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full bg-blue-500 relative transition-all"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Progress handle */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg
                       opacity-0 group-hover:opacity-100 transition-opacity
                       transform translate-x-1/2"
          />
        </div>
      </div>

      {/* Time Display */}
      <div className="px-4 py-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => skip(-5)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          title="Skip back 5 seconds"
        >
          <SkipBack size={20} className="text-gray-600 dark:text-gray-300" />
        </button>

        <button
          onClick={togglePlayPause}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center
                     text-white shadow-lg transition-all hover:scale-105"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" className="ml-1" />
          )}
        </button>

        <button
          onClick={() => skip(5)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          title="Skip forward 5 seconds"
        >
          <SkipForward size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>
    </div>
  );
}

export default TTSPlayer;
