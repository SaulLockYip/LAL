import { Router, Request, Response } from 'express';
import { prisma } from '../services/ai.js';

export const articlesRouter = Router();

// Helper function for response format
function successResponse(data: unknown) {
  return { success: true, data };
}

function errorResponse(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// Decode article content (handle base64 encoding)
function decodeArticleContent(content: string): string {
  try {
    const decoded = Buffer.from(content, 'base64').toString('utf-8');
    // Check if still looks like base64 and decode again if needed
    if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
      return Buffer.from(decoded, 'base64').toString('utf-8');
    }
    return decoded;
  } catch {
    return content;
  }
}

// Polling helper with timeout
async function pollWithTimeout<T>(
  pollFn: () => Promise<T | null>,
  checkDone: (result: T) => boolean,
  intervalMs: number = 3000,
  maxRetries: number = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await pollFn();
    if (result && checkDone(result)) {
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Polling timed out');
}

// GET /api/articles - List articles with search/filter/sort
articlesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search,
      level,
      archived,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit,
      offset,
    } = req.query;

    const where: Record<string, unknown> = {};

    // Filter by archived status
    if (archived !== undefined) {
      where.archived = archived === 'true';
    }

    // Filter by level
    if (level && typeof level === 'string') {
      where.level = level;
    }

    // Search in title and content
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { source: { contains: search } },
      ];
    }

    // Sorting
    const orderBy: Record<string, string> = {};
    if (sortBy === 'title') {
      orderBy.title = sortOrder === 'asc' ? 'asc' : 'desc';
    } else if (sortBy === 'level') {
      orderBy.level = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';
    }

    const take = limit ? parseInt(limit as string) : undefined;
    const skip = offset ? parseInt(offset as string) : undefined;

    const articles = await prisma.article.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        _count: {
          select: {
            wordLists: true,
            exercises: true,
          },
        },
      },
    });

    // Remove base64 encoded content from list view for performance
    const articlesForClient = articles.map(article => ({
      id: article.id,
      title: article.title,
      source: article.source,
      level: article.level,
      archived: article.archived,
      createdAt: article.createdAt,
      wordCount: article._count.wordLists,
      exerciseCount: article._count.exercises,
    }));

    res.json(successResponse(articlesForClient));
    return;
  } catch (error) {
    console.error('Error listing articles:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list articles'));
    return;
  }
});

// GET /api/articles/:id - Get single article
articlesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        wordLists: {
          orderBy: { id: 'desc' },
        },
        exercises: {
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!article) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
      return;
    }

    res.json(successResponse(article));
    return;
  } catch (error) {
    console.error('Error getting article:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get article'));
    return;
  }
});

// DELETE /api/articles/:id - Delete article
articlesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
      return;
    }

    // Delete related word lists and exercises first
    await prisma.wordList.deleteMany({
      where: { articleId: id },
    });

    await prisma.exercise.deleteMany({
      where: { articleId: id },
    });

    // Delete the article
    await prisma.article.delete({
      where: { id },
    });

    res.json(successResponse({ deleted: true }));
    return;
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete article'));
    return;
  }
});

// POST /api/articles/:id/tts - Generate TTS audio for an article
articlesRouter.post('/:id/tts', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Get article by id
    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Article not found'));
      return;
    }

    // Get TTS settings from AISetting
    const aiSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    // Use ttsApiKey if set, otherwise fallback to apiKey, then to hardcoded key
    const apiKey = aiSetting?.ttsApiKey || aiSetting?.apiKey || 'sk-cp-Lq2PlyRtE-o2yibZjqeyFjIAMYg1N-N9UIuh_Oxrf2DIvJkwyvP5mRAVeq18Ax2RIuJ-3x8IVDrXtswpa-322Dg0SNt0gtvlHTphMjkARSy4LumKU8RIsS8';

    // Decode article content
    const articleContent = decodeArticleContent(article.content);

    // Get target language from user settings for language_boost
    const user = await prisma.user.findFirst();
    const targetLanguage = user?.targetLanguage || 'English';

    // Build TTS request
    const ttsRequest = {
      model: 'speech-2.8-hd',
      text: articleContent,
      voice_setting: {
        voice_id: aiSetting?.ttsVoiceId || 'Chinese (Mandarin)_Reliable_Executive',
        speed: aiSetting?.ttsSpeed ?? 1.0,
        vol: aiSetting?.ttsVol ?? 1.0,
        pitch: aiSetting?.ttsPitch ?? 0,
        ...(aiSetting?.ttsEmotion && { emotion: aiSetting.ttsEmotion }),
      },
      audio_setting: {
        audio_sample_rate: aiSetting?.ttsAudioSampleRate ?? 32000,
        bitrate: aiSetting?.ttsBitrate ?? 128000,
        format: 'mp3',
        channel: aiSetting?.ttsChannel ?? 1,
      },
      language_boost: targetLanguage,
    };

    // Create TTS task
    const createResponse = await fetch('https://api.minimaxi.com/v1/t2a_async_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(ttsRequest),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('MiniMax TTS API error:', createResponse.status, errorText);
      res.status(500).json(errorResponse('TTS_API_ERROR', 'Failed to create TTS task'));
      return;
    }

    const createData = await createResponse.json();

    if (createData.base_resp.status_code !== 0) {
      console.error('MiniMax TTS error:', createData.base_resp.status_msg);
      res.status(500).json(errorResponse('TTS_API_ERROR', createData.base_resp.status_msg || 'Failed to create TTS task'));
      return;
    }

    const taskId = createData.task_id;

    // Poll for completion
    const pollResponse = await pollWithTimeout<{ status: string; file_id?: string; status_msg?: string }>(
      async () => {
        try {
          const resp = await fetch(`https://api.minimaxi.com/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          });
          if (!resp.ok) return null;
          return await resp.json();
        } catch {
          return null;
        }
      },
      (result) => result.status === 'Success' || result.status === 'Fail',
      3000,
      100
    );

    if (pollResponse.status === 'Fail') {
      res.status(500).json(errorResponse('TTS_API_ERROR', pollResponse.status_msg || 'TTS generation failed'));
      return;
    }

    if (!pollResponse.file_id) {
      res.status(500).json(errorResponse('TTS_API_ERROR', 'No file_id in response'));
      return;
    }

    // Download audio
    const downloadResponse = await fetch(`https://api.minimaxi.com/v1/files/retrieve_content?file_id=${pollResponse.file_id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!downloadResponse.ok) {
      console.error('MiniMax download error:', downloadResponse.status);
      res.status(500).json(errorResponse('TTS_API_ERROR', 'Failed to download audio'));
      return;
    }

    // Convert binary to base64
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    // Save to TTS table (upsert)
    await prisma.tTS.upsert({
      where: { articleId: id },
      update: {
        audioData: audioBase64,
      },
      create: {
        articleId: id,
        audioData: audioBase64,
      },
    });

    res.json(successResponse({ audioData: audioBase64 }));
    return;
  } catch (error) {
    console.error('Error generating TTS:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to generate TTS'));
    return;
  }
});

// GET /api/articles/:id/tts - Get TTS audio for an article
articlesRouter.get('/:id/tts', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const tts = await prisma.tTS.findUnique({
      where: { articleId: id },
    });

    if (!tts) {
      res.status(404).json(errorResponse('NOT_FOUND', 'TTS not found for this article'));
      return;
    }

    res.json(successResponse({ audioData: tts.audioData }));
    return;
  } catch (error) {
    console.error('Error getting TTS:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get TTS'));
    return;
  }
});
