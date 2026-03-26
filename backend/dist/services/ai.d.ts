import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ChatOptions {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey: string;
    baseUrl: string;
    streaming?: boolean;
}
export interface WordLookupResult {
    word: string;
    partOfSpeech: string;
    phonetic: string;
    definition: string;
    translation: string;
    exampleSentence: string;
    inflections: Record<string, unknown>;
    synonyms: string[];
    phrases: string[];
    field: string;
}
export interface DerivationEtymologyResult {
    derivation: {
        prefix: string;
        prefixMeaning: string;
        root: string;
        rootPid: string;
        rootMeaning: string;
        suffix: string;
        suffixMeaning: string;
    };
    etymology: {
        explanation: string;
        explanationTranslation: string;
    };
}
export interface ExerciseResult {
    type: 'choice' | 'fill_blank';
    question: string;
    options?: string[];
}
export interface GradingResult {
    totalScore: number;
    results: Array<{
        questionIndex: number;
        correct: boolean;
        userAnswer: string;
        score: number;
        comment: string;
    }>;
    overallComment: string;
}
export declare function chat(messages: ChatMessage[], options: ChatOptions): Promise<string>;
export declare function chatStreaming(messages: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void): Promise<void>;
export declare function lookupWord(word: string, contextParagraph: string): Promise<WordLookupResult>;
export declare function getDerivationEtymology(word: string): Promise<DerivationEtymologyResult>;
export declare function generateExercises(articleContent: string, wordListJson: string): Promise<ExerciseResult[]>;
export declare function gradeExercises(questionsJson: string, userAnswersJson: string, articleContent: string, wordListJson: string): Promise<GradingResult>;
export { prisma };
//# sourceMappingURL=ai.d.ts.map