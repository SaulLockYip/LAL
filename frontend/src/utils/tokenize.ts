/**
 * Hybrid text tokenization for language learning:
 * - English/Latin: whitespace split + punctuation cleaning
 * - CJK (Chinese/Japanese/Korean): Intl.Segmenter word boundary detection
 * - Mixed content: process by script segments
 */

// Script detection based on Unicode ranges
function detectScript(char: string): 'cjk' | 'latin' | 'other' {
  const code = char.codePointAt(0);
  if (!code) return 'other';

  // CJK Unified Ideographs + Extension + Japanese/Korean compat
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
    (code >= 0x3040 && code <= 0x30FF) ||  // Japanese Hiragana/Katakana
    (code >= 0xAC00 && code <= 0xD7AF) ||  // Korean Hangul
    (code >= 0x3000 && code <= 0x303F)     // CJK Symbols/Punctuation
  ) {
    return 'cjk';
  }

  // Basic Latin + Latin-1 Supplement (English, European languages)
  if ((code >= 0x0000 && code <= 0x024F)) {
    return 'latin';
  }

  return 'other';
}

// Check if text contains CJK characters
function hasCJK(text: string): boolean {
  for (const char of text) {
    if (detectScript(char) === 'cjk') return true;
  }
  return false;
}

// Check if text contains Japanese characters (Hiragana/Katakana: 0x3040-0x30FF)
function hasJapanese(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x3040 && code <= 0x30FF) {
      return true;
    }
  }
  return false;
}

// Check if text contains Latin characters
function hasLatin(text: string): boolean {
  for (const char of text) {
    if (detectScript(char) === 'latin') return true;
  }
  return false;
}

// Intl.Segmenter type declaration for older TypeScript versions
declare namespace Intl {
  interface Segmenter {
    segment(text: string): Iterable<{
      segment: string;
      index: number;
      input: string;
      isWordLike: boolean;
    }>;
  }
  interface SegmenterConstructor {
    new (locale: string, options?: { granularity?: 'word' | 'sentence' | 'grapheme' }): Segmenter;
  }
  const Segmenter: SegmenterConstructor;
}

// CJK segment with word/non-word classification
interface CJKSegment {
  text: string;
  isWord: boolean;
}

// Tokenize CJK text using Intl.Segmenter
// Returns ALL segments (words AND punctuation) so original text can be reconstructed
function tokenizeCJK(text: string): CJKSegment[] {
  // Intl.Segmenter is supported in modern browsers
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // Use 'ja' locale for Japanese text (works for all CJK)
      // Use 'zh' locale for Chinese/Korean text
      const locale = hasJapanese(text) ? 'ja' : 'zh';
      const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
      const segments = [...segmenter.segment(text)];
      return segments
        .filter(s => !/^\s+$/.test(s.segment)) // Filter out whitespace-only segments
        .map(s => ({
          text: s.segment,
          isWord: s.isWordLike
        }))
        .filter(s => s.text.length > 0);
    } catch {
      // Fallback to character-level if Intl.Segmenter fails
    }
  }

  // Fallback: group consecutive non-punctuation CJK characters into words
  // This prevents single-character splitting of Japanese/Chinese words like "浅草寺"
  const chars = text.split('');
  const groups: CJKSegment[] = [];
  let currentGroup = '';

  for (const char of chars) {
    if (/\s/.test(char)) {
      if (currentGroup) {
        groups.push({ text: currentGroup, isWord: true });
        currentGroup = '';
      }
      continue;
    }
    currentGroup += char;
  }

  if (currentGroup) {
    groups.push({ text: currentGroup, isWord: true });
  }

  return groups;
}

// Split text into segments by script type
interface TextSegment {
  text: string;
  script: 'cjk' | 'latin' | 'mixed';
}

// Group consecutive characters by script type
function groupByScript(text: string): TextSegment[] {
  if (text.length === 0) return [];

  const segments: TextSegment[] = [];
  let currentScript: 'cjk' | 'latin' | 'other' | null = null;
  let currentText = '';

  for (const char of text) {
    const script = detectScript(char);

    if (script === currentScript) {
      currentText += char;
    } else {
      if (currentText.length > 0 && currentScript !== 'other') {
        segments.push({
          text: currentText,
          script: currentScript === 'cjk' ? 'cjk' : 'latin'
        });
      }
      currentScript = script;
      currentText = char;
    }
  }

  // Push final segment
  if (currentText.length > 0 && currentScript !== 'other') {
    segments.push({
      text: currentText,
      script: currentScript === 'cjk' ? 'cjk' : 'latin'
    });
  }

  return segments;
}

export interface Token {
  text: string;
  isWord: boolean; // true if this is a valid word token (clickable)
  displayText: string; // text to show (with original spacing/punctuation)
}

// Main tokenizer: handles mixed CJK/Latin content
export function tokenizeParagraph(paragraph: string): Token[] {
  const tokens: Token[] = [];

  // First split by newlines to handle paragraph breaks
  const lines = paragraph.split('\n');

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Detect overall script composition
    const hasCJKChars = hasCJK(line);
    const hasLatinChars = hasLatin(line);

    if (hasCJKChars && hasLatinChars) {
      // Mixed content: tokenize by script segments
      const scriptSegments = groupByScript(line);

      for (const segment of scriptSegments) {
        if (segment.script === 'cjk') {
          const cjkSegments = tokenizeCJK(segment.text);
          for (const seg of cjkSegments) {
            tokens.push({
              text: seg.isWord ? seg.text : '', // Only words have text for lookup
              isWord: seg.isWord,
              displayText: seg.text // Always preserve original text
            });
          }
        } else if (segment.script === 'latin') {
          // For Latin, use simple whitespace splitting and preserve original spacing
          const parts = segment.text.split(/(\s+)/);
          for (const part of parts) {
            if (/^\s+$/.test(part)) {
              // Whitespace - preserve as non-word token
              tokens.push({ text: '', isWord: false, displayText: part });
            } else if (part.length > 0) {
              // Word - clean punctuation for lookup
              const cleaned = part.replace(/[.,!?;:'"()[\]{}·–—$/\\]/g, '');
              if (cleaned.length > 0) {
                tokens.push({
                  text: cleaned,
                  isWord: true,
                  displayText: part // Preserve original including punctuation
                });
              }
            }
          }
        }
      }
    } else if (hasCJKChars) {
      // Pure CJK - use Intl.Segmenter to get all segments
      const cjkSegments = tokenizeCJK(line);
      for (const seg of cjkSegments) {
        tokens.push({
          text: seg.isWord ? seg.text : '', // Only words have text for lookup
          isWord: seg.isWord,
          displayText: seg.text // Always preserve original text
        });
      }
    } else {
      // Pure Latin/English - preserve original spacing
      const parts = line.split(/(\s+)/);
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          // Whitespace - preserve as non-word token
          tokens.push({ text: '', isWord: false, displayText: part });
        } else if (part.length > 0) {
          // Word - clean punctuation for lookup
          const cleaned = part.replace(/[.,!?;:'"()[\]{}·–—$/\\]/g, '');
          if (cleaned.length > 0) {
            tokens.push({
              text: cleaned,
              isWord: true,
              displayText: part // Preserve original including punctuation
            });
          }
        }
      }
    }

    // Add space between lines (as a separate token to preserve structure)
    if (tokens.length > 0 && tokens[tokens.length - 1].displayText !== ' ') {
      tokens.push({ text: '', isWord: false, displayText: ' ' });
    }
  }

  return tokens;
}

// Simple word tokenization for a single word (for cleaning user selection)
export function cleanWord(word: string): string {
  // Remove common punctuation but preserve CJK characters
  return word.replace(/[.,!?;:'"()[\]{}·–—$/\\]/g, '');
}
