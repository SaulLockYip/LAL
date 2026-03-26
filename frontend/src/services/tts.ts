/**
 * TTS Word Synchronization Types and Utilities
 */

// Sentence timing data from backend (SRT format parsed)
export interface Sentence {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

// Word-level timing calculated from sentence timings
export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
  charIndex: number; // character position in sentence text
  sentenceIndex: number; // which sentence this word belongs to
}

/**
 * Parse SRT format timing string to seconds
 * SRT format: HH:MM:SS,mmm --> HH:MM:SS.mmm
 */
export function parseSRTTime(timeStr: string): number {
  const parts = timeStr.replace(',', '.').split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parse SRT content to sentences
 * SRT format:
 * 1
 * 00:00:00,000 --> 00:00:02,500
 * Hello world.
 *
 * 2
 * 00:00:03,000 --> 00:00:05,000
 * This is a sentence.
 */
export function parseSRT(srtContent: string): Sentence[] {
  const sentences: Sentence[] = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    // Find the timing line (contains -->)
    const timingLine = lines.find(line => line.includes('-->'));
    if (!timingLine) continue;

    const timingParts = timingLine.split('-->').map(t => t.trim());
    if (timingParts.length !== 2) continue;

    const start = parseSRTTime(timingParts[0]);
    const end = parseSRTTime(timingParts[1]);

    // Text is everything after the timing line
    const textLines = lines.slice(lines.indexOf(timingLine) + 1);
    const text = textLines.join(' ').replace(/<[^>]*>/g, '').trim(); // Remove HTML tags

    if (text) {
      sentences.push({ text, start, end });
    }
  }

  return sentences;
}

/**
 * Calculate word timings from sentence timings using proportional allocation
 * Words are allocated time based on their character length proportion within the sentence
 */
export function calculateWordTimings(sentences: Sentence[]): WordTiming[] {
  const wordTimings: WordTiming[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    // Split sentence into words (preserving punctuation attached to words)
    const words = sentence.text.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) return;

    // Calculate total character length (excluding spaces)
    const totalChars = words.reduce((sum, word) => sum + word.length, 0);
    const sentenceDuration = sentence.end - sentence.start;

    let charPosition = 0;

    words.forEach((word) => {
      // Proportional time allocation based on character length
      const wordCharRatio = word.length / totalChars;
      const wordDuration = sentenceDuration * wordCharRatio;

      // Add a small minimum duration and distribute remainder
      const minDuration = 0.05; // 50ms minimum per word
      const calculatedDuration = Math.max(wordDuration, minDuration);

      const wordStart = sentence.start + (sentenceDuration * charPosition / totalChars);
      const wordEnd = wordStart + calculatedDuration;

      wordTimings.push({
        word,
        start: wordStart,
        end: wordEnd,
        charIndex: charPosition,
        sentenceIndex,
      });

      charPosition += word.length;
    });
  });

  return wordTimings;
}

/**
 * Find the current word index based on playback time
 */
export function findCurrentWordIndex(wordTimings: WordTiming[], currentTime: number): number {
  for (let i = wordTimings.length - 1; i >= 0; i--) {
    if (currentTime >= wordTimings[i].start) {
      return i;
    }
  }
  return -1;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get sentences with their text organized
 */
export function groupWordsBySentence(wordTimings: WordTiming[]): Map<number, WordTiming[]> {
  const grouped = new Map<number, WordTiming[]>();

  wordTimings.forEach((wt) => {
    if (!grouped.has(wt.sentenceIndex)) {
      grouped.set(wt.sentenceIndex, []);
    }
    grouped.get(wt.sentenceIndex)!.push(wt);
  });

  return grouped;
}
