import { Router, Request, Response } from 'express';
import { prisma } from '../services/ai.js';

export const ttsRouter = Router();

// Helper function for response format
function successResponse(data: unknown) {
  return { success: true, data };
}

function errorResponse(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// GET /api/tts - List all TTS entries with article info
ttsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const ttsEntries = await prisma.tTS.findMany({
      select: {
        id: true,
        articleId: true,
        audioData: true,
        sentenceData: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse sentenceData JSON where present
    const entriesForClient = ttsEntries.map(entry => ({
      ...entry,
      sentenceData: entry.sentenceData ? JSON.parse(entry.sentenceData) : null,
    }));

    res.json(successResponse(entriesForClient));
    return;
  } catch (error) {
    console.error('Error listing TTS entries:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list TTS entries'));
    return;
  }
});

// DELETE /api/tts/:id - Hard delete a TTS entry by ID
ttsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const ttsEntry = await prisma.tTS.findUnique({
      where: { id },
    });

    if (!ttsEntry) {
      res.status(404).json(errorResponse('NOT_FOUND', 'TTS entry not found'));
      return;
    }

    await prisma.tTS.delete({
      where: { id },
    });

    res.json(successResponse({ deleted: true }));
    return;
  } catch (error) {
    console.error('Error deleting TTS entry:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete TTS entry'));
    return;
  }
});
