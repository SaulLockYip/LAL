import { Router, Request, Response } from 'express';
import { prisma, chat } from '../services/ai.js';

export const chatRouter = Router();

// Helper function for response format
function successResponse(data: unknown) {
  return { success: true, data };
}

function errorResponse(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// POST /api/chat - Chat with AI about article
chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { articleId, message } = req.body;

    if (!message) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'message is required'));
      return;
    }

    // Get AI settings from database
    const aiSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    if (!aiSetting || !aiSetting.apiKey) {
      res.status(400).json(errorResponse('AI_NOT_CONFIGURED', 'AI settings not configured. Please configure AI settings first.'));
      return;
    }

    // Build messages for chat
    const messages = [
      { role: 'user' as const, content: message }
    ];

    // Call AI
    const response = await chat(messages, {
      provider: aiSetting.provider as 'openai' | 'anthropic',
      model: aiSetting.modelName,
      apiKey: aiSetting.apiKey,
      baseUrl: aiSetting.baseUrl,
    });

    res.json(successResponse({ response }));
    return;
  } catch (error) {
    console.error('Error in chat:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json(errorResponse('AI_ERROR', message));
    return;
  }
});
