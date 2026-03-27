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
export type ExerciseType = 'choice' | 'fill_blank' | 'open_ended' | 'translation' | 'word_explanation' | 'sentence_imitation';
export declare const IELTS_BANDS: {
    9: string;
    8: string;
    7: string;
    6: string;
    5: string;
    4: string;
    3: string;
    2: string;
    1: string;
    0: string;
};
export interface ExerciseResult {
    type: ExerciseType;
    question: string;
    options?: string[];
    correctAnswers?: string[];
    blanks?: number;
    sampleAnswer?: string;
    rubric?: {
        bands: Record<string, {
            min: number;
            max: number;
            description: string;
        }>;
        criteria: string[];
    };
    explanation?: string;
}
export interface PerQuestionAnalysis {
    isCorrect: boolean;
    correctAnswer: string;
    keyPoints: string[];
    explanation: string;
    improvementSuggestions: string[];
}
export interface GradingResult {
    totalScore: number;
    bandScore: number;
    results: Array<{
        questionIndex: number;
        exerciseId: number;
        type: ExerciseType;
        correct: boolean;
        userAnswer: string;
        expectedAnswer?: string;
        score: number;
        maxScore: number;
        bandScore: number;
        comment: string;
        analysis: PerQuestionAnalysis;
    }>;
    overallComment: string;
    strengths: string[];
    areasForImprovement: string[];
}
export declare function chat(messages: ChatMessage[], options: ChatOptions): Promise<string>;
export declare function chatStreaming(messages: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void): Promise<void>;
export declare function lookupWord(word: string, contextParagraph: string): Promise<WordLookupResult>;
export declare function getDerivationEtymology(word: string): Promise<DerivationEtymologyResult>;
export declare function generateExercises(articleContent: string, wordListJson: string, options?: {
    countPerType?: Partial<Record<ExerciseType, number>>;
    userNativeLanguage?: string;
    userTargetLanguage?: string;
    userLevel?: string;
}): Promise<ExerciseResult[]>;
export declare function gradeExercises(exercisesJson: string, userAnswersJson: string, articleContent: string, wordListJson: string, options?: {
    userNativeLanguage?: string;
    userTargetLanguage?: string;
    userLevel?: string;
}): Promise<GradingResult>;
export { prisma };
//# sourceMappingURL=ai.d.ts.map