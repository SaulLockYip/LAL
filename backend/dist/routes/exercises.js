import { Router } from 'express';
import { prisma, generateExercises, gradeExercises } from '../services/ai.js';
export const exercisesRouter = Router();
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}
// POST /api/exercises/generate - Generate exercises for article
exercisesRouter.post('/generate', async (req, res) => {
    try {
        const { articleId } = req.body;
        if (!articleId) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'articleId is required'));
            return;
        }
        // Get article
        const article = await prisma.article.findUnique({
            where: { id: articleId },
            include: {
                wordLists: true,
            },
        });
        if (!article) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
            return;
        }
        // Get word list as JSON
        const wordListJson = JSON.stringify(article.wordLists.map(w => ({
            word: w.word,
            definition: w.definition,
            translation: w.translation,
        })));
        // Generate exercises using AI
        const exercises = await generateExercises(article.content, wordListJson);
        // Store exercises in database
        const createdExercises = await Promise.all(exercises.map(ex => prisma.exercise.create({
            data: {
                articleId,
                type: ex.type,
                questionContent: ex.question,
                options: ex.options ? JSON.stringify(ex.options) : null,
                status: 'pending',
            },
        })));
        res.json(successResponse(createdExercises));
        return;
    }
    catch (error) {
        console.error('Error generating exercises:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate exercises';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
// POST /api/exercises/:id/submit - Submit answers and grade
exercisesRouter.post('/:id/submit', async (req, res) => {
    try {
        const id = req.params.id;
        const { answers } = req.body; // Array of { questionIndex, answer }
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid exercise ID'));
            return;
        }
        if (!answers || !Array.isArray(answers)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'answers array is required'));
            return;
        }
        // Get exercise
        const exercise = await prisma.exercise.findUnique({
            where: { id: parsedId },
        });
        if (!exercise) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Exercise not found'));
            return;
        }
        // Get all exercises for this article to build complete question set
        const allExercises = await prisma.exercise.findMany({
            where: { articleId: exercise.articleId },
            orderBy: { id: 'asc' },
        });
        // Get article and word list
        const article = await prisma.article.findUnique({
            where: { id: exercise.articleId },
            include: { wordLists: true },
        });
        if (!article) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
            return;
        }
        // Build questions JSON
        const questionsJson = JSON.stringify(allExercises.map((ex, idx) => ({
            index: idx,
            type: ex.type,
            question: ex.questionContent,
            options: ex.options ? JSON.parse(ex.options) : null,
        })));
        // Build user answers JSON
        const userAnswersJson = JSON.stringify(answers);
        // Build word list JSON
        const wordListJson = JSON.stringify(article.wordLists.map(w => ({
            word: w.word,
            definition: w.definition,
            translation: w.translation,
        })));
        // Grade with AI
        const gradingResult = await gradeExercises(questionsJson, userAnswersJson, article.content, wordListJson);
        // Update exercise with grading results
        const updatedExercise = await prisma.exercise.update({
            where: { id: parsedId },
            data: {
                status: 'graded',
                correctAnswers: JSON.stringify(gradingResult.results),
                score: gradingResult.totalScore,
                comments: gradingResult.overallComment,
            },
        });
        res.json(successResponse({
            exercise: updatedExercise,
            grading: gradingResult,
        }));
        return;
    }
    catch (error) {
        console.error('Error grading exercise:', error);
        const message = error instanceof Error ? error.message : 'Failed to grade exercise';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
// GET /api/exercises?articleId=xxx - List exercises
exercisesRouter.get('/', async (req, res) => {
    try {
        const { articleId, status, sortBy = 'id', sortOrder = 'desc' } = req.query;
        const where = {};
        if (articleId && typeof articleId === 'string') {
            where.articleId = articleId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        const orderBy = {};
        if (sortBy === 'score') {
            orderBy.score = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        else if (sortBy === 'createdAt') {
            orderBy.id = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        else {
            orderBy.id = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        const exercises = await prisma.exercise.findMany({
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
        const exercisesForClient = exercises.map(ex => ({
            ...ex,
            options: ex.options ? JSON.parse(ex.options) : null,
            correctAnswers: ex.correctAnswers ? JSON.parse(ex.correctAnswers) : null,
        }));
        res.json(successResponse(exercisesForClient));
        return;
    }
    catch (error) {
        console.error('Error listing exercises:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list exercises'));
        return;
    }
});
// GET /api/exercises/:id - Get single exercise
exercisesRouter.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid exercise ID'));
            return;
        }
        const exercise = await prisma.exercise.findUnique({
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
        if (!exercise) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Exercise not found'));
            return;
        }
        res.json(successResponse({
            ...exercise,
            options: exercise.options ? JSON.parse(exercise.options) : null,
            correctAnswers: exercise.correctAnswers ? JSON.parse(exercise.correctAnswers) : null,
        }));
        return;
    }
    catch (error) {
        console.error('Error getting exercise:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get exercise'));
        return;
    }
});
//# sourceMappingURL=exercises.js.map