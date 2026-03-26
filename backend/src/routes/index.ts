import { Router } from 'express';
import { articlesRouter } from './articles.js';
import { wordsRouter } from './words.js';
import { exercisesRouter } from './exercises.js';
import { settingsRouter } from './settings.js';
import { chatRouter } from './chat.js';
import { ttsRouter } from './tts.js';

export const router = Router();

// Mount route modules
router.use('/articles', articlesRouter);
router.use('/words', wordsRouter);
router.use('/exercises', exercisesRouter);
router.use('/settings', settingsRouter);
router.use('/chat', chatRouter);
router.use('/tts', ttsRouter);

// Health check / info endpoint
router.get('/', (_req, res) => {
  res.json({ message: 'LAL API v0.1.0', endpoints: ['articles', 'words', 'exercises', 'settings', 'tts'] });
});
