import { Router, Request, Response } from 'express';
import { prisma, generateExercises, gradeExercises } from '../services/ai.js';

export const exercisesRouter = Router();

// Helper function for response format
function successResponse(data: unknown) {
  return { success: true, data };
}

// Helper function to decode base64 content
function decodeBase64Content(content: string): string {
  try {
    const decoded = atob(content);
    // If still looks like base64 (only contains base64 chars), decode again
    if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
      return atob(decoded);
    }
    return decoded;
  } catch {
    // Content might not be base64 encoded
    return content;
  }
}

function errorResponse(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// POST /api/exercises/generate - Generate exercises for article
exercisesRouter.post('/generate', async (req: Request, res: Response) => {
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
    const wordListJson = JSON.stringify(
      article.wordLists.map(w => ({
        word: w.word,
        definition: w.definition,
        translation: w.translation,
      }))
    );

    // Generate exercises using AI
    const decodedContent = decodeBase64Content(article.content);
    const exercises = await generateExercises(decodedContent, wordListJson);

    // Store exercises in database
    const createdExercises = await Promise.all(
      exercises.map(ex =>
        prisma.exercise.create({
          data: {
            articleId,
            type: ex.type,
            questionContent: ex.question,
            options: ex.options ? JSON.stringify(ex.options) : null,
            status: 'pending',
          },
        })
      )
    );

    res.json(successResponse(createdExercises));
    return;
  } catch (error) {
    console.error('Error generating exercises:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate exercises';
    res.status(500).json(errorResponse('AI_ERROR', message));
    return;
  }
});

// POST /api/exercises/:id/submit - Submit answers and grade
exercisesRouter.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
    const questionsJson = JSON.stringify(
      allExercises.map((ex, idx) => ({
        index: idx,
        type: ex.type,
        question: ex.questionContent,
        options: ex.options ? JSON.parse(ex.options) : null,
      }))
    );

    // Build user answers JSON
    const userAnswersJson = JSON.stringify(answers);

    // Build word list JSON
    const wordListJson = JSON.stringify(
      article.wordLists.map(w => ({
        word: w.word,
        definition: w.definition,
        translation: w.translation,
      }))
    );

    // Grade with AI
    const gradingResult = await gradeExercises(
      questionsJson,
      userAnswersJson,
      article.content,
      wordListJson
    );

    // Update all exercises with their individual grading results
    const updatedExercises = await Promise.all(
      allExercises.map((ex, index) => {
        const result = gradingResult.results[index];
        return prisma.exercise.update({
          where: { id: ex.id },
          data: {
            status: 'graded',
            correctAnswers: JSON.stringify(result ? [result] : []),
            score: result?.score ?? 0,
            comments: gradingResult.overallComment,
          },
        });
      })
    );

    res.json(successResponse({
      exercises: updatedExercises,
      grading: gradingResult,
    }));
    return;
  } catch (error) {
    console.error('Error grading exercise:', error);
    const message = error instanceof Error ? error.message : 'Failed to grade exercise';
    res.status(500).json(errorResponse('AI_ERROR', message));
    return;
  }
});

// GET /api/exercises?articleId=xxx - List exercises
exercisesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { articleId, status, sortBy = 'id', sortOrder = 'asc' } = req.query;

    const where: Record<string, unknown> = {};

    if (articleId && typeof articleId === 'string') {
      where.articleId = articleId;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    const orderBy: Record<string, string> = {};
    if (sortBy === 'score') {
      orderBy.score = sortOrder === 'asc' ? 'asc' : 'desc';
    } else if (sortBy === 'createdAt') {
      orderBy.id = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
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
  } catch (error) {
    console.error('Error listing exercises:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list exercises'));
    return;
  }
});

// GET /api/exercises/:id - Get single exercise
exercisesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
  } catch (error) {
    console.error('Error getting exercise:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get exercise'));
    return;
  }
});

// DELETE /api/exercises/:id - Delete an exercise
exercisesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const parsedId = parseInt(id);

    if (isNaN(parsedId)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid exercise ID'));
      return;
    }

    // Check if exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: parsedId },
    });

    if (!exercise) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Exercise not found'));
      return;
    }

    // Hard delete the exercise
    await prisma.exercise.delete({
      where: { id: parsedId },
    });

    res.json(successResponse({ deleted: true }));
    return;
  } catch (error) {
    console.error('Error deleting exercise:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete exercise'));
    return;
  }
});

// DELETE /api/exercises/article/:articleId - Delete all exercises for an article
exercisesRouter.delete('/article/:articleId', async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;

    if (!articleId) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'articleId is required'));
      return;
    }

    // Check if exercises exist for this article
    const exercisesCount = await prisma.exercise.count({
      where: { articleId },
    });

    if (exercisesCount === 0) {
      res.status(404).json(errorResponse('NOT_FOUND', 'No exercises found for this article'));
      return;
    }

    // Hard delete all exercises for the article
    await prisma.exercise.deleteMany({
      where: { articleId },
    });

    res.json(successResponse({ deleted: exercisesCount }));
    return;
  } catch (error) {
    console.error('Error deleting all exercises:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete exercises'));
    return;
  }
});
