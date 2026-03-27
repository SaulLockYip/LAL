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
    start: number;
    end: number;
}
/**
 * Parse SRT content string and extract sentence timings
 */
export declare function parseSRT(srtContent: string): SentenceTiming[];
/**
 * Convert sentence timings to JSON string for storage
 */
export declare function sentenceTimingsToJSON(sentences: SentenceTiming[]): string;
/**
 * Parse sentence timings from JSON string
 */
export declare function sentenceTimingsFromJSON(json: string): SentenceTiming[];
/**
 * Parse MiniMax TTS titles (JSON format) and convert to SentenceTiming[]
 * MiniMax returns a JSON array with timing info in milliseconds
 */
export declare function parseMiniMaxTitles(titlesJson: string): SentenceTiming[];
//# sourceMappingURL=srtParser.d.ts.map