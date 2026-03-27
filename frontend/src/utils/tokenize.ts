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

// Check if text contains Latin characters
function hasLatin(text: string): boolean {
  for (const char of text) {
    if (detectScript(char) === 'latin') return true;
  }
  return false;
}

// Check if character is CJK punctuation (should not be part of word)
function isCJKPunctuation(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;

  // CJK punctuation range
  return (code >= 0x3000 && code <= 0x303F);
}

// Tokenize Latin/English text: split by whitespace, clean punctuation
function tokenizeLatin(text: string): string[] {
  return text
    .split(/\s+/)
    .map(word => word.replace(/[.,!?;:'"()[\]{}·–—$/\\]/g, ''))
    .filter(word => word.length > 0);
}

// Intl.Segmenter type declaration for older TypeScript versions
declare namespace Intl {
  interface Segmenter {
    segment(text: string): Iterable<{
      segment: string;
      index: number;
      input: string;
      isWord: boolean;
    }>;
  }
  interface SegmenterConstructor {
    new (locale: string, options?: { granularity?: 'word' | 'sentence' | 'grapheme' }): Segmenter;
  }
  const Segmenter: SegmenterConstructor;
}

// Tokenize CJK text using Intl.Segmenter
function tokenizeCJK(text: string): string[] {
  // Intl.Segmenter is supported in modern browsers
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
      const segments = [...segmenter.segment(text)];
      return segments
        .filter(s => s.isWord && !/^\s+$/.test(s.segment))
        .map(s => s.segment.trim())
        .filter(w => w.length > 0);
    } catch {
      // Fallback to character-level if Intl.Segmenter fails
    }
  }

  // Fallback: character-level tokenization for CJK
  // Each character is a potential word for language learning
  return text.split('').filter(char => {
    const code = char.codePointAt(0);
    if (!code) return false;
    // Filter out spaces and CJK punctuation
    if (/\s/.test(char)) return false;
    if (isCJKPunctuation(char)) return false;
    return true;
  });
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
          const words = tokenizeCJK(segment.text);
          for (const word of words) {
            tokens.push({
              text: word,
              isWord: true,
              displayText: word
            });
          }
        } else if (segment.script === 'latin') {
          const words = tokenizeLatin(segment.text);
          for (const word of words) {
            if (word.length >= 1) { // Include single chars for CJK mix
              tokens.push({
                text: word,
                isWord: true,
                displayText: word
              });
            }
          }
        }
      }
    } else if (hasCJKChars) {
      // Pure CJK
      const words = tokenizeCJK(line);
      for (const word of words) {
        tokens.push({
          text: word,
          isWord: true,
          displayText: word
        });
      }
    } else {
      // Pure Latin/English
      const words = tokenizeLatin(line);
      for (const word of words) {
        if (word.length >= 1) {
          tokens.push({
            text: word,
            isWord: true,
            displayText: word
          });
        }
      }
    }

    // Add space between lines
    if (tokens.length > 0) {
      tokens[tokens.length - 1].displayText += ' ';
    }
  }

  return tokens;
}

// Simple word tokenization for a single word (for cleaning user selection)
export function cleanWord(word: string): string {
  // Remove common punctuation but preserve CJK characters
  return word.replace(/[.,!?;:'"()[\]{}·–—$/\\]/g, '');
}
