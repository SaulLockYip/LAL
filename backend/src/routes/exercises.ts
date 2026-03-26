import { Router, Request, Response } from 'express';
import { prisma, generateExercises, gradeExercises, GradingResult, ExerciseType } from '../services/ai.js';

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
    const { articleId, options } = req.body;

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

    // Get user settings for language info
    const user = await prisma.user.findFirst();

    // Get word list as JSON
    const wordListJson = JSON.stringify(
      article.wordLists.map(w => ({
        word: w.word,
        definition: w.definition,
        translation: w.translation,
      }))
    );

    // Determine total number of exercises to be generated for progress tracking
    const counts = {
      choice: options?.countPerType?.choice ?? 2,
      fill_blank: options?.countPerType?.fill_blank ?? 2,
      open_ended: options?.countPerType?.open_ended ?? 1,
      translation: options?.countPerType?.translation ?? 1,
      word_explanation: options?.countPerType?.word_explanation ?? 1,
      sentence_imitation: options?.countPerType?.sentence_imitation ?? 1,
    };
    const totalExercises = Object.values(counts).reduce((a, b) => a + b, 0);

    // Generate a session ID to group exercises taken together
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial progress response using write (not json(), which ends the response)
    res.write(JSON.stringify(successResponse({
      progress: {
        current: 0,
        total: totalExercises,
        currentStep: 'Preparing to generate exercises...',
        status: 'generating'
      }
    })) + '\n');

    // Generate exercises using AI with proper language settings
    const decodedContent = decodeBase64Content(article.content);
    const exercises = await generateExercises(decodedContent, wordListJson, {
      userNativeLanguage: user?.nativeLanguage,
      userTargetLanguage: user?.targetLanguage,
      userLevel: user?.currentLevel,
      countPerType: options?.countPerType,
    });

    // Build generation progress steps
    const exerciseTypes: Record<ExerciseType, string> = {
      'choice': 'Multiple Choice',
      'fill_blank': 'Fill in the Blank',
      'open_ended': 'Open-ended Question',
      'translation': 'Translation',
      'word_explanation': 'Word Explanation',
      'sentence_imitation': 'Sentence Imitation',
    };

    // Store exercises in database with all metadata
    const createdExercises: Array<{
      id: number;
      articleId: number;
      type: string;
      questionContent: string;
      options: string | null;
      correctAnswers: string | null;
      explanation: string | null;
      status: string;
      sessionId: string;
    }> = [];

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const typeLabel = exerciseTypes[ex.type] || ex.type;

      // Send progress update for each exercise being stored
      res.write(JSON.stringify(successResponse({
        progress: {
          current: i + 1,
          total: totalExercises,
          currentStep: `Storing ${typeLabel} question ${i + 1} of ${totalExercises}...`,
          status: 'generating'
        }
      })) + '\n');

      const created = await prisma.exercise.create({
        data: {
          articleId,
          type: ex.type,
          questionContent: typeof ex.question === 'object'
            ? JSON.stringify(ex.question)
            : ex.question,
          options: ex.options ? JSON.stringify(ex.options) : null,
          correctAnswers: ex.correctAnswers ? JSON.stringify(ex.correctAnswers) : null,
          rubric: ex.rubric ? JSON.stringify(ex.rubric) : null,
          sampleAnswer: ex.sampleAnswer ? JSON.stringify(ex.sampleAnswer) : null,
          partialScoring: ex.blanks ? JSON.stringify({ totalBlanks: ex.blanks }) : null,
          explanation: ex.explanation || null,
          status: 'pending',
          sessionId,
        },
      });
      createdExercises.push(created);
    }

    // Send final response with all exercises
    res.write(JSON.stringify(successResponse({
      progress: {
        current: totalExercises,
        total: totalExercises,
        currentStep: `Generated ${totalExercises} exercises successfully!`,
        status: 'completed'
      },
      exercises: createdExercises.map(ex => ({
        id: ex.id,
        articleId: ex.articleId,
        type: ex.type,
        questionContent: parseQuestionContent(ex.questionContent, ex.type),
        options: ex.options ? JSON.parse(ex.options) : null,
        correctAnswers: ex.correctAnswers ? JSON.parse(ex.correctAnswers) : null,
        explanation: ex.explanation,
        status: ex.status,
        sessionId: ex.sessionId,
      })),
      sessionId,
    })) + '\n');
    res.end();
    return;
  } catch (error) {
    console.error('Error generating exercises:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate exercises';
    res.status(500).json(errorResponse('AI_ERROR', message));
    return;
  }
});

// Helper function to parse question content based on type
function parseQuestionContent(content: string, type: string): unknown {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    // Return as plain string
    return content;
  }
}

// POST /api/exercises/:id/submit - Submit answers and grade
exercisesRouter.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { answers, sessionId } = req.body; // Array of { questionIndex, answer }

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

    // Get user settings for language info
    const user = await prisma.user.findFirst();

    // Get all exercises for this session (or article if no sessionId)
    // Use sessionId if provided, otherwise use articleId
    const sessionFilter = sessionId
      ? { sessionId }
      : { articleId: exercise.articleId };

    const allExercises = await prisma.exercise.findMany({
      where: sessionFilter,
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

    // Decode article content BEFORE passing to grading
    const decodedContent = decodeBase64Content(article.content);

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial progress response using write
    res.write(JSON.stringify(successResponse({
      progress: {
        current: 0,
        total: allExercises.length,
        currentStep: 'Preparing to grade exercises...',
        status: 'grading'
      }
    })) + '\n');

    // Build exercises JSON with full metadata for grading
    const exercisesJson = JSON.stringify(
      allExercises.map((ex, idx) => ({
        id: ex.id,
        type: ex.type,
        question: parseQuestionContent(ex.questionContent, ex.type),
        options: ex.options ? JSON.parse(ex.options) : null,
        correctAnswers: ex.correctAnswers ? JSON.parse(ex.correctAnswers) : null,
        blanks: ex.partialScoring ? JSON.parse(ex.partialScoring).totalBlanks : null,
        sampleAnswer: ex.sampleAnswer ? JSON.parse(ex.sampleAnswer) : null,
        rubric: ex.rubric ? JSON.parse(ex.rubric) : null,
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

    // Send progress: starting AI grading
    res.write(JSON.stringify(successResponse({
      progress: {
        current: 0,
        total: allExercises.length,
        currentStep: `Grading ${allExercises.length} exercises with AI...`,
        status: 'grading'
      }
    })) + '\n');

    // Grade with AI (pass decoded content, not base64)
    const gradingResult = await gradeExercises(
      exercisesJson,
      userAnswersJson,
      decodedContent,
      wordListJson,
      {
        userNativeLanguage: user?.nativeLanguage,
        userTargetLanguage: user?.targetLanguage,
        userLevel: user?.currentLevel,
      }
    );

    // Create a map of exercise ID to grading result for easy lookup
    const gradingMap = new Map<number, GradingResult['results'][0]>();
    for (const result of gradingResult.results) {
      if (result.exerciseId) {
        gradingMap.set(result.exerciseId, result);
      }
    }

    // Exercise type labels for progress display
    const exerciseTypes: Record<string, string> = {
      'choice': 'Multiple Choice',
      'fill_blank': 'Fill in the Blank',
      'open_ended': 'Open-ended Question',
      'translation': 'Translation',
      'word_explanation': 'Word Explanation',
      'sentence_imitation': 'Sentence Imitation',
    };

    // Update all exercises with their individual grading results and send progress
    const updatedExercises: Array<{
      id: number;
      articleId: number;
      type: string;
      questionContent: string;
      options: string | null;
      correctAnswers: string | null;
      explanation: string | null;
      status: string;
      score: number | null;
      bandScore: number | null;
      comments: string | null;
      analysis: string | null;
      sessionId: string;
    }> = [];

    for (let i = 0; i < allExercises.length; i++) {
      const ex = allExercises[i];
      const result = gradingMap.get(ex.id);
      const typeLabel = exerciseTypes[ex.type] || ex.type;

      // Send progress update for each exercise being graded
      res.write(JSON.stringify(successResponse({
        progress: {
          current: i + 1,
          total: allExercises.length,
          currentStep: `Grading ${typeLabel} question ${i + 1} of ${allExercises.length}...`,
          status: 'grading'
        }
      })) + '\n');

      const updated = await prisma.exercise.update({
        where: { id: ex.id },
        data: {
          status: 'graded',
          score: result?.score ?? null,
          bandScore: result?.bandScore ?? null,
          comments: result?.comment ?? gradingResult.overallComment,
          analysis: result?.analysis ? JSON.stringify(result.analysis) : null,
        },
      });
      updatedExercises.push(updated);
    }

    // Return updated exercises with parsed fields and grading summary
    const exercisesForClient = updatedExercises.map(ex => ({
      id: ex.id,
      articleId: ex.articleId,
      type: ex.type,
      questionContent: parseQuestionContent(ex.questionContent, ex.type),
      options: ex.options ? JSON.parse(ex.options) : null,
      correctAnswers: ex.correctAnswers ? JSON.parse(ex.correctAnswers) : null,
      explanation: ex.explanation,
      status: ex.status,
      score: ex.score,
      bandScore: ex.bandScore,
      comments: ex.comments,
      analysis: ex.analysis ? JSON.parse(ex.analysis) : null,
      sessionId: ex.sessionId,
    }));

    // Send final response
    res.write(JSON.stringify(successResponse({
      progress: {
        current: allExercises.length,
        total: allExercises.length,
        currentStep: `Graded ${allExercises.length} exercises successfully!`,
        status: 'completed'
      },
      exercises: exercisesForClient,
      grading: {
        totalScore: gradingResult.totalScore,
        bandScore: gradingResult.bandScore,
        overallComment: gradingResult.overallComment,
        strengths: gradingResult.strengths,
        areasForImprovement: gradingResult.areasForImprovement,
      },
    })) + '\n');
    res.end();
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
    const { articleId, status, sessionId, sortBy = 'id', sortOrder = 'asc' } = req.query;

    const where: Record<string, unknown> = {};

    if (articleId && typeof articleId === 'string') {
      where.articleId = articleId;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (sessionId && typeof sessionId === 'string') {
      where.sessionId = sessionId;
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

    // Parse JSON fields and format for client
    const exercisesForClient = exercises.map(ex => ({
      id: ex.id,
      articleId: ex.articleId,
      type: ex.type,
      questionContent: parseQuestionContent(ex.questionContent, ex.type),
      options: ex.options ? JSON.parse(ex.options) : null,
      correctAnswers: ex.correctAnswers ? JSON.parse(ex.correctAnswers) : null,
      rubric: ex.rubric ? JSON.parse(ex.rubric) : null,
      sampleAnswer: ex.sampleAnswer ? JSON.parse(ex.sampleAnswer) : null,
      partialScoring: ex.partialScoring ? JSON.parse(ex.partialScoring) : null,
      explanation: ex.explanation,
      status: ex.status,
      score: ex.score,
      bandScore: ex.bandScore,
      comments: ex.comments,
      analysis: ex.analysis ? JSON.parse(ex.analysis) : null,
      sessionId: ex.sessionId,
      createdAt: ex.createdAt,
      article: ex.article,
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
      id: exercise.id,
      articleId: exercise.articleId,
      type: exercise.type,
      questionContent: parseQuestionContent(exercise.questionContent, exercise.type),
      options: exercise.options ? JSON.parse(exercise.options) : null,
      correctAnswers: exercise.correctAnswers ? JSON.parse(exercise.correctAnswers) : null,
      rubric: exercise.rubric ? JSON.parse(exercise.rubric) : null,
      sampleAnswer: exercise.sampleAnswer ? JSON.parse(exercise.sampleAnswer) : null,
      partialScoring: exercise.partialScoring ? JSON.parse(exercise.partialScoring) : null,
      explanation: exercise.explanation,
      status: exercise.status,
      score: exercise.score,
      bandScore: exercise.bandScore,
      comments: exercise.comments,
      analysis: exercise.analysis ? JSON.parse(exercise.analysis) : null,
      sessionId: exercise.sessionId,
      createdAt: exercise.createdAt,
      article: exercise.article,
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
    const articleId = req.params.articleId as string;

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
