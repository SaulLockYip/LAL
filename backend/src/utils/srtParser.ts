/**
 * SRT (SubRip Subtitle) Parser
 * Parses SRT format subtitles and extracts sentence timings
 *
 * SRT Format:
 * 1
 * 00:00:00,000 --> 00:00:02,500
 * Sentence text
 *
 * 2
 * 00:00:02,500 --> 00:00:05,000
 * Another sentence
 */

export interface SentenceTiming {
  text: string;
  start: number; // in seconds (float)
  end: number;   // in seconds (float)
}

/**
 * Parse SRT content string and extract sentence timings
 */
export function parseSRT(srtContent: string): SentenceTiming[] {
  const sentences: SentenceTiming[] = [];

  // Normalize line endings and split into blocks
  const blocks = srtContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Skip the index line (first line is just a number)
    // Second line contains the timestamp
    // Remaining lines are the subtitle text
    const timestampLine = lines[1];
    if (!timestampLine) continue;

    const textLines = lines.slice(2);

    // Parse timestamp: "00:00:00,000 --> 00:00:02,500"
    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );

    if (!timestampMatch || timestampMatch.length < 9) continue;

    const startHours = parseInt(timestampMatch[1]!, 10);
    const startMinutes = parseInt(timestampMatch[2]!, 10);
    const startSeconds = parseInt(timestampMatch[3]!, 10);
    const startMilliseconds = parseInt(timestampMatch[4]!, 10);
    const endHours = parseInt(timestampMatch[5]!, 10);
    const endMinutes = parseInt(timestampMatch[6]!, 10);
    const endSeconds = parseInt(timestampMatch[7]!, 10);
    const endMilliseconds = parseInt(timestampMatch[8]!, 10);

    const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;

    const text = textLines.join(' ').trim();

    if (text) {
      sentences.push({ text, start, end });
    }
  }

  return sentences;
}

/**
 * Convert sentence timings to JSON string for storage
 */
export function sentenceTimingsToJSON(sentences: SentenceTiming[]): string {
  return JSON.stringify(sentences);
}

/**
 * Parse sentence timings from JSON string
 */
export function sentenceTimingsFromJSON(json: string): SentenceTiming[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// MiniMax TTS titles format (returned in .titles file within tar archive)
interface MiniMaxTitleEntry {
  text: string;
  pronounce_text: string;
  time_begin: number; // in milliseconds
  time_end: number;   // in milliseconds
  text_begin: number;
  text_end: number;
  pronounce_text_begin: number;
  pronounce_text_end: number;
}

/**
 * Parse MiniMax TTS titles (JSON format) and convert to SentenceTiming[]
 * MiniMax returns a JSON array with timing info in milliseconds
 */
export function parseMiniMaxTitles(titlesJson: string): SentenceTiming[] {
  try {
    const entries: MiniMaxTitleEntry[] = JSON.parse(titlesJson);
    return entries.map(entry => ({
      text: entry.text,
      start: entry.time_begin / 1000, // Convert ms to seconds
      end: entry.time_end / 1000,     // Convert ms to seconds
    }));
  } catch {
    return [];
  }
}
