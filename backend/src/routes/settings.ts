import { Router, Request, Response } from 'express';
import { prisma, chat } from '../services/ai.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const settingsRouter = Router();

// Voice data type
interface Voice {
  name: string;
  lang: string;
  displayName: string;
}

// Helper function for response format
function successResponse(data: unknown) {
  return { success: true, data };
}

function errorResponse(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// Parse voices from say -v output
function parseVoices(output: string): Voice[] {
  const lines = output.trim().split('\n');
  const voices: Voice[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Format: "VoiceName              language    # sample text"
    const match = line.match(/^(.+?)\s+(\S+)\s+#\s*/);
    if (match && match[1] && match[2]) {
      const name = match[1].trim();
      const lang = match[2].trim();
      // Extract just the voice name without parenthetical suffixes
      const displayName = name.replace(/\s*\([^)]*\)/g, '').trim();
      const key = `${displayName}|${lang}`;
      if (!seen.has(key)) {
        seen.add(key);
        voices.push({ name, lang, displayName });
      }
    }
  }
  return voices;
}

// GET /api/settings/voices - Get available macOS TTS voices
settingsRouter.get('/voices', async (_req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('say -v \'?\' 2>&1');
    const voices = parseVoices(stdout);
    res.json(successResponse(voices));
    return;
  } catch (error) {
    console.error('Error getting voices:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get available voices'));
    return;
  }
});

// Test AI connection
async function testAIConnection(provider: string, model: string, apiKey: string, baseUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const messages = [{ role: 'user' as const, content: 'Hi, please reply with "OK" if you can read this.' }];

    if (provider === 'openai') {
      await chat(messages, { provider: 'openai', model, apiKey, baseUrl });
    } else {
      await chat(messages, { provider: 'anthropic', model, apiKey, baseUrl });
    }

    return { success: true, message: 'Connection successful!' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Connection failed: ${message}` };
  }
}

// GET /api/settings/user - Get user config
settingsRouter.get('/user', async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst();

    // Get TTS settings from AISetting
    const aiSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    if (!user) {
      res.json(successResponse({
        id: null,
        name: '',
        nativeLanguage: 'Chinese',
        targetLanguage: 'English',
        currentLevel: 'A2',
        voice: null,
        ttsApiKey: aiSetting?.ttsApiKey || null,
        ttsVoiceId: aiSetting?.ttsVoiceId || 'Chinese (Mandarin)_Reliable_Executive',
        ttsSpeed: aiSetting?.ttsSpeed ?? 1.0,
        ttsVol: aiSetting?.ttsVol ?? 10.0,
        ttsPitch: aiSetting?.ttsPitch ?? 0,
        ttsEmotion: aiSetting?.ttsEmotion || null,
        ttsAudioSampleRate: aiSetting?.ttsAudioSampleRate ?? 32000,
        ttsBitrate: aiSetting?.ttsBitrate ?? 128000,
        ttsChannel: aiSetting?.ttsChannel ?? 1,
        ttsSoundEffects: aiSetting?.ttsSoundEffects || null,
      }));
      return;
    }

    res.json(successResponse({
      ...user,
      ttsApiKey: aiSetting?.ttsApiKey || null,
      ttsVoiceId: aiSetting?.ttsVoiceId || 'Chinese (Mandarin)_Reliable_Executive',
      ttsSpeed: aiSetting?.ttsSpeed ?? 1.0,
      ttsVol: aiSetting?.ttsVol ?? 10.0,
      ttsPitch: aiSetting?.ttsPitch ?? 0,
      ttsEmotion: aiSetting?.ttsEmotion || null,
      ttsAudioSampleRate: aiSetting?.ttsAudioSampleRate ?? 32000,
      ttsBitrate: aiSetting?.ttsBitrate ?? 128000,
      ttsChannel: aiSetting?.ttsChannel ?? 1,
      ttsSoundEffects: aiSetting?.ttsSoundEffects || null,
    }));
    return;
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get user settings'));
    return;
  }
});

// PUT /api/settings/user - Update user config
settingsRouter.put('/user', async (req: Request, res: Response) => {
  try {
    const {
      name, nativeLanguage, targetLanguage, currentLevel, voice,
      ttsApiKey, ttsVoiceId, ttsSpeed, ttsVol, ttsPitch, ttsEmotion,
      ttsAudioSampleRate, ttsBitrate, ttsChannel, ttsSoundEffects
    } = req.body;

    // Check if this is a TTS-only update (only TTS fields present)
    const isTTSOnlyUpdate = !name && !nativeLanguage && !targetLanguage && !currentLevel && voice === undefined &&
      (ttsApiKey !== undefined || ttsVoiceId !== undefined || ttsSpeed !== undefined ||
       ttsVol !== undefined || ttsPitch !== undefined || ttsEmotion !== undefined ||
       ttsAudioSampleRate !== undefined || ttsBitrate !== undefined ||
       ttsChannel !== undefined || ttsSoundEffects !== undefined);

    // Validate required fields only if not a TTS-only update
    if (!isTTSOnlyUpdate && (!nativeLanguage || !targetLanguage || !currentLevel)) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'nativeLanguage, targetLanguage, and currentLevel are required')
      );
      return;
    }

    // Find existing user or create new one
    const existingUser = await prisma.user.findFirst();

    // If TTS-only update but no existing user, we can't proceed
    if (isTTSOnlyUpdate && !existingUser) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'User must be created first before saving TTS settings')
      );
      return;
    }

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: name || existingUser.name,
          nativeLanguage,
          targetLanguage,
          currentLevel,
          voice: voice !== undefined ? voice : existingUser.voice,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: name || 'User',
          nativeLanguage,
          targetLanguage,
          currentLevel,
          voice: voice || null,
        },
      });
    }

    // Update TTS settings in AISetting
    const existingAISetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    if (existingAISetting) {
      await prisma.aISetting.update({
        where: { id: existingAISetting.id },
        data: {
          ttsApiKey: ttsApiKey !== undefined ? ttsApiKey : existingAISetting.ttsApiKey,
          ttsVoiceId: ttsVoiceId !== undefined ? ttsVoiceId : existingAISetting.ttsVoiceId,
          ttsSpeed: ttsSpeed !== undefined ? ttsSpeed : existingAISetting.ttsSpeed,
          ttsVol: ttsVol !== undefined ? ttsVol : existingAISetting.ttsVol,
          ttsPitch: ttsPitch !== undefined ? ttsPitch : existingAISetting.ttsPitch,
          ttsEmotion: ttsEmotion !== undefined ? ttsEmotion : existingAISetting.ttsEmotion,
          ttsAudioSampleRate: ttsAudioSampleRate !== undefined ? ttsAudioSampleRate : existingAISetting.ttsAudioSampleRate,
          ttsBitrate: ttsBitrate !== undefined ? ttsBitrate : existingAISetting.ttsBitrate,
          ttsChannel: ttsChannel !== undefined ? ttsChannel : existingAISetting.ttsChannel,
          ttsSoundEffects: ttsSoundEffects !== undefined ? ttsSoundEffects : existingAISetting.ttsSoundEffects,
        },
      });
    } else if (ttsApiKey || ttsVoiceId || ttsSpeed || ttsVol || ttsPitch || ttsEmotion || ttsAudioSampleRate || ttsBitrate || ttsChannel || ttsSoundEffects) {
      // Create new AISetting with TTS settings if any are provided
      await prisma.aISetting.create({
        data: {
          name: 'default',
          provider: 'openai',
          modelName: '',
          baseUrl: '',
          apiKey: '',
          ttsApiKey: ttsApiKey || null,
          ttsVoiceId: ttsVoiceId || 'Chinese (Mandarin)_Reliable_Executive',
          ttsSpeed: ttsSpeed ?? 1.0,
          ttsVol: ttsVol ?? 10.0,
          ttsPitch: ttsPitch ?? 0,
          ttsEmotion: ttsEmotion || null,
          ttsAudioSampleRate: ttsAudioSampleRate ?? 32000,
          ttsBitrate: ttsBitrate ?? 128000,
          ttsChannel: ttsChannel ?? 1,
          ttsSoundEffects: ttsSoundEffects || null,
        },
      });
    }

    res.json(successResponse({
      ...user,
      ttsApiKey: ttsApiKey !== undefined ? ttsApiKey : null,
      ttsVoiceId: ttsVoiceId !== undefined ? ttsVoiceId : 'Chinese (Mandarin)_Reliable_Executive',
      ttsSpeed: ttsSpeed !== undefined ? ttsSpeed : 1.0,
      ttsVol: ttsVol !== undefined ? ttsVol : 10.0,
      ttsPitch: ttsPitch !== undefined ? ttsPitch : 0,
      ttsEmotion: ttsEmotion !== undefined ? ttsEmotion : null,
      ttsAudioSampleRate: ttsAudioSampleRate !== undefined ? ttsAudioSampleRate : 32000,
      ttsBitrate: ttsBitrate !== undefined ? ttsBitrate : 128000,
      ttsChannel: ttsChannel !== undefined ? ttsChannel : 1,
      ttsSoundEffects: ttsSoundEffects !== undefined ? ttsSoundEffects : null,
    }));
    return;
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update user settings'));
    return;
  }
});

// GET /api/settings/ai - Get AI settings
settingsRouter.get('/ai', async (_req: Request, res: Response) => {
  try {
    const aiSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    if (!aiSetting) {
      res.json(successResponse(null));
      return;
    }

    // Don't expose the actual API key
    res.json(successResponse({
      id: aiSetting.id,
      name: aiSetting.name,
      provider: aiSetting.provider,
      modelName: aiSetting.modelName,
      baseUrl: aiSetting.baseUrl,
      hasApiKey: !!aiSetting.apiKey,
    }));
    return;
  } catch (error) {
    console.error('Error getting AI settings:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get AI settings'));
    return;
  }
});

// PUT /api/settings/ai - Update AI settings
settingsRouter.put('/ai', async (req: Request, res: Response) => {
  try {
    const { provider, modelName, baseUrl, apiKey } = req.body;

    // Validate required fields
    if (!provider || !modelName || !baseUrl) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'provider, modelName, and baseUrl are required')
      );
      return;
    }

    // Validate provider
    if (provider !== 'openai' && provider !== 'anthropic') {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'provider must be "openai" or "anthropic"')
      );
      return;
    }

    // Find existing setting or create new one
    const existingSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    let aiSetting;
    if (existingSetting) {
      aiSetting = await prisma.aISetting.update({
        where: { id: existingSetting.id },
        data: {
          provider,
          modelName,
          baseUrl,
          apiKey: apiKey || existingSetting.apiKey,
        },
      });
    } else {
      if (!apiKey) {
        res.status(400).json(
          errorResponse('VALIDATION_ERROR', 'apiKey is required for new AI settings')
        );
        return;
      }
      aiSetting = await prisma.aISetting.create({
        data: {
          name: 'default',
          provider,
          modelName,
          baseUrl,
          apiKey,
        },
      });
    }

    // Don't expose the actual API key
    res.json(successResponse({
      id: aiSetting.id,
      name: aiSetting.name,
      provider: aiSetting.provider,
      modelName: aiSetting.modelName,
      baseUrl: aiSetting.baseUrl,
      hasApiKey: !!aiSetting.apiKey,
    }));
    return;
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update AI settings'));
    return;
  }
});

// GET /api/settings/tts-voices - Get available MiniMax TTS voices
settingsRouter.get('/tts-voices', async (req: Request, res: Response) => {
  try {
    const { language } = req.query;

    // Get API key from AISetting
    const aiSetting = await prisma.aISetting.findFirst({
      where: { name: 'default' },
    });

    // Use ttsApiKey if set, otherwise fallback to apiKey, then to hardcoded key
    const apiKey = aiSetting?.ttsApiKey || aiSetting?.apiKey || 'sk-cp-Lq2PlyRtE-o2yibZjqeyFjIAMYg1N-N9UIuh_Oxrf2DIvJkwyvP5mRAVeq18Ax2RIuJ-3x8IVDrXtswpa-322Dg0SNt0gtvlHTphMjkARSy4LumKU8RIsS8';

    const response = await fetch('https://api.minimaxi.com/v1/get_voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ voice_type: 'system' }),
    });

    if (!response.ok) {
      console.error('MiniMax API error:', response.status);
      res.json(successResponse([]));
      return;
    }

    const data = await response.json() as { system_voice?: Array<{ voice_id?: string; voice_name?: string; description?: string[] }> };
    let voices = data.system_voice || [];

    // Filter by language if provided
    if (language && typeof language === 'string') {
      const langLower = language.toLowerCase();
      voices = voices.filter((voice: { voice_id?: string; voice_name?: string }) => {
        const voiceId = voice.voice_id?.toLowerCase() || '';
        const voiceName = voice.voice_name?.toLowerCase() || '';
        return voiceId.includes(langLower) || voiceName.includes(langLower);
      });
    }

    // Return filtered voice list with required fields
    const filteredVoices = voices.map((voice) => ({
      voice_id: voice.voice_id || '',
      voice_name: voice.voice_name || '',
      description: voice.description || [],
    }));

    res.json(successResponse(filteredVoices));
    return;
  } catch (error) {
    console.error('Error getting TTS voices:', error);
    res.json(successResponse([]));
    return;
  }
});

// POST /api/settings/ai/test - Test AI connection
settingsRouter.post('/ai/test', async (req: Request, res: Response) => {
  try {
    const { provider, modelName, apiKey, baseUrl } = req.body;

    if (!provider || !modelName || !apiKey || !baseUrl) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'provider, modelName, apiKey, and baseUrl are required')
      );
      return;
    }

    const result = await testAIConnection(provider, modelName, apiKey, baseUrl);
    res.json(successResponse(result));
    return;
  } catch (error) {
    console.error('Error testing AI connection:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to test AI connection'));
    return;
  }
});
