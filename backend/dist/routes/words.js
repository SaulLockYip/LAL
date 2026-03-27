import { Router } from 'express';
import { prisma } from '../services/ai.js';
export const wordsRouter = Router();
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}
// GET /api/words?articleId=xxx - List words for article
wordsRouter.get('/', async (req, res) => {
    try {
        const { articleId, search, sortBy = 'id', sortOrder = 'desc' } = req.query;
        const where = {};
        if (articleId && typeof articleId === 'string') {
            where.articleId = articleId;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { word: { contains: search } },
                { definition: { contains: search } },
                { translation: { contains: search } },
            ];
        }
        const orderBy = {};
        if (sortBy === 'word') {
            orderBy.word = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        else {
            orderBy.id = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        const words = await prisma.wordList.findMany({
            where,
            orderBy,
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
        // Parse JSON fields
        const wordsForClient = words.map(word => ({
            ...word,
            inflections: word.inflections ? JSON.parse(word.inflections) : null,
            synonyms: word.synonyms ? JSON.parse(word.synonyms) : [],
            phrases: word.phrases ? JSON.parse(word.phrases) : [],
            derivation: word.derivation ? JSON.parse(word.derivation) : null,
            etymology: word.etymology ? JSON.parse(word.etymology) : null,
        }));
        res.json(successResponse(wordsForClient));
        return;
    }
    catch (error) {
        console.error('Error listing words:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list words'));
        return;
    }
});
// POST /api/words - Create word from lookup
wordsRouter.post('/', async (req, res) => {
    try {
        const { articleId, word, partOfSpeech, phonetic, definition, translation, exampleSentence, field, inflections, synonyms, phrases, derivation, etymology, } = req.body;
        if (!articleId || !word) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'articleId and word are required'));
            return;
        }
        // Check if article exists
        const article = await prisma.article.findUnique({
            where: { id: articleId },
        });
        if (!article) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
            return;
        }
        // Prepare JSON fields
        const inflectionsJson = JSON.stringify(inflections || {});
        const synonymsJson = JSON.stringify(synonyms || []);
        const phrasesJson = JSON.stringify(phrases || []);
        const derivationJson = derivation ? JSON.stringify(derivation) : null;
        const etymologyJson = etymology ? JSON.stringify(etymology) : null;
        // Create word record directly with provided data
        const newWord = await prisma.wordList.create({
            data: {
                articleId,
                word,
                partOfSpeech: partOfSpeech || null,
                phonetic: phonetic || null,
                definition: definition || null,
                translation: translation || null,
                exampleSentence: exampleSentence || null,
                field: field || null,
                inflections: inflectionsJson,
                synonyms: synonymsJson,
                phrases: phrasesJson,
                derivation: derivationJson,
                etymology: etymologyJson,
            },
        });
        res.json(successResponse({
            ...newWord,
            inflections: inflections || {},
            synonyms: synonyms || [],
            phrases: phrases || [],
            derivation: derivation || null,
            etymology: etymology || null,
        }));
        return;
    }
    catch (error) {
        console.error('Error creating word:', error);
        const message = error instanceof Error ? error.message : 'Failed to create word';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
// GET /api/words/:id - Get single word
wordsRouter.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid word ID'));
            return;
        }
        const word = await prisma.wordList.findUnique({
            where: { id: parsedId },
            include: {
                article: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
        if (!word) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Word not found'));
            return;
        }
        res.json(successResponse({
            ...word,
            inflections: word.inflections ? JSON.parse(word.inflections) : null,
            synonyms: word.synonyms ? JSON.parse(word.synonyms) : [],
            phrases: word.phrases ? JSON.parse(word.phrases) : [],
            derivation: word.derivation ? JSON.parse(word.derivation) : null,
            etymology: word.etymology ? JSON.parse(word.etymology) : null,
        }));
        return;
    }
    catch (error) {
        console.error('Error getting word:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get word'));
        return;
    }
});
// DELETE /api/words/:id - Delete word
wordsRouter.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid word ID'));
            return;
        }
        const word = await prisma.wordList.findUnique({
            where: { id: parsedId },
        });
        if (!word) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Word not found'));
            return;
        }
        await prisma.wordList.delete({
            where: { id: parsedId },
        });
        res.json(successResponse({ deleted: true }));
        return;
    }
    catch (error) {
        console.error('Error deleting word:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete word'));
        return;
    }
});
// POST /api/words/lookup - Lookup a word using AI
wordsRouter.post('/lookup', async (req, res) => {
    try {
        const { word, articleId, articleContent, context, userInfo } = req.body;
        if (!word) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'word is required'));
            return;
        }
        // Import the AI functions dynamically to avoid circular dependencies
        const { lookupWord } = await import('../services/ai.js');
        // The articleContent is already decoded plain text from frontend
        // Pass the full article content as context paragraph so AI can extract relevant context
        const result = await lookupWord(word, articleContent || '');
        res.json(successResponse(result));
        return;
    }
    catch (error) {
        console.error('Error looking up word:', error);
        const message = error instanceof Error ? error.message : 'Failed to lookup word';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
// POST /api/words/derivation - Get word derivation/etymology
wordsRouter.post('/derivation', async (req, res) => {
    try {
        const { word } = req.body;
        if (!word) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'word is required'));
            return;
        }
        // Import the AI functions dynamically to avoid circular dependencies
        const { getDerivationEtymology } = await import('../services/ai.js');
        const result = await getDerivationEtymology(word);
        res.json(successResponse(result));
        return;
    }
    catch (error) {
        console.error('Error getting derivation:', error);
        const message = error instanceof Error ? error.message : 'Failed to get derivation';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
// POST /api/words/etymology - Get word etymology (same endpoint, returns same data)
wordsRouter.post('/etymology', async (req, res) => {
    try {
        const { word } = req.body;
        if (!word) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'word is required'));
            return;
        }
        // Import the AI functions dynamically to avoid circular dependencies
        const { getDerivationEtymology } = await import('../services/ai.js');
        const result = await getDerivationEtymology(word);
        res.json(successResponse(result));
        return;
    }
    catch (error) {
        console.error('Error getting etymology:', error);
        const message = error instanceof Error ? error.message : 'Failed to get etymology';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
//# sourceMappingURL=words.js.map