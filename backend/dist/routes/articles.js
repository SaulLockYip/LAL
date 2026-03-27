import { Router } from 'express';
import { prisma } from '../services/ai.js';
import { parseMiniMaxTitles, sentenceTimingsToJSON } from '../utils/srtParser.js';
import * as tarStream from 'tar-stream';
import { Readable } from 'stream';
export const articlesRouter = Router();
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}
// Decode article content (handle base64 encoding)
function decodeArticleContent(content) {
    try {
        const decoded = Buffer.from(content, 'base64').toString('utf-8');
        // Check if still looks like base64 and decode again if needed
        if (/^[A-Za-z0-9+/=]+$/.test(decoded) && decoded.length > 10) {
            return Buffer.from(decoded, 'base64').toString('utf-8');
        }
        return decoded;
    }
    catch {
        return content;
    }
}
// Polling helper with timeout
async function pollWithTimeout(pollFn, checkDone, intervalMs = 3000, maxRetries = 100) {
    for (let i = 0; i < maxRetries; i++) {
        const result = await pollFn();
        if (result && checkDone(result)) {
            return result;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('Polling timed out');
}
// Extract MP3 and titles from tar archive in a single pass (MiniMax returns tar when subtitle is requested)
async function extractFromTar(buffer) {
    return new Promise((resolve, reject) => {
        const extract = tarStream.extract();
        let audioBuffer = null;
        let subtitleText = undefined;
        let rejected = false;
        extract.on('entry', (header, stream, next) => {
            const chunks = [];
            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });
            stream.on('end', () => {
                if (rejected) {
                    next();
                    return;
                }
                const content = Buffer.concat(chunks);
                // Look for the file with the target extension
                if (header.name.endsWith('.mp3')) {
                    audioBuffer = content;
                }
                else if (header.name.endsWith('.titles')) {
                    subtitleText = content.toString('utf-8');
                }
                next();
            });
            stream.on('error', (err) => {
                if (!rejected) {
                    rejected = true;
                    reject(err);
                }
            });
        });
        extract.on('finish', () => {
            if (rejected)
                return;
            if (audioBuffer) {
                resolve({ audioBuffer, subtitleText });
            }
            else {
                reject(new Error('No .mp3 file found in tar archive'));
            }
        });
        extract.on('error', (err) => {
            if (!rejected) {
                rejected = true;
                reject(err);
            }
        });
        // Pipe the buffer into the tar extractor
        const readable = Readable.from(buffer);
        readable.pipe(extract);
    });
}
// Check if buffer is a valid tar archive (starts with tar magic number)
function isTarBuffer(buffer) {
    // TAR format: pre-POSIX ustar starts with 257 "ustar", POSIX starts with 257 "ustar\x00"
    // The first 257 bytes are the magic, but a simple check is to look for "ustar" near byte 257
    if (buffer.length < 512)
        return false;
    // Check for "ustar" at offset 257 (257-262 in 0-indexed)
    const magic = buffer.toString('ascii', 257, 262);
    return magic === 'ustar';
}
// GET /api/articles - List articles with search/filter/sort
articlesRouter.get('/', async (req, res) => {
    try {
        const { search, level, archived, sortBy = 'createdAt', sortOrder = 'desc', limit, offset, } = req.query;
        const where = {};
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
        const orderBy = {};
        if (sortBy === 'title') {
            orderBy.title = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        else if (sortBy === 'level') {
            orderBy.level = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        else {
            orderBy.createdAt = sortOrder === 'asc' ? 'asc' : 'desc';
        }
        const take = limit ? parseInt(limit) : undefined;
        const skip = offset ? parseInt(offset) : undefined;
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
    }
    catch (error) {
        console.error('Error listing articles:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list articles'));
        return;
    }
});
// GET /api/articles/:id - Get single article
articlesRouter.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
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
        // Decode base64-encoded content before sending to frontend
        const decodedContent = decodeArticleContent(article.content);
        const articleWithDecodedContent = {
            ...article,
            content: decodedContent,
        };
        res.json(successResponse(articleWithDecodedContent));
        return;
    }
    catch (error) {
        console.error('Error getting article:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get article'));
        return;
    }
});
// DELETE /api/articles/:id - Delete article
articlesRouter.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
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
    }
    catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete article'));
        return;
    }
});
// POST /api/articles/:id/tts - Generate TTS audio for an article
articlesRouter.post('/:id/tts', async (req, res) => {
    try {
        const id = req.params.id;
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
        // Validate that settings exist
        if (!aiSetting) {
            res.status(500).json(errorResponse('CONFIG_ERROR', 'AI settings not configured. Please set up AI settings in the database.'));
            return;
        }
        // Use ttsApiKey if set, otherwise use apiKey
        const apiKey = aiSetting.ttsApiKey || aiSetting.apiKey;
        if (!apiKey) {
            res.status(500).json(errorResponse('CONFIG_ERROR', 'No API key configured. Please set ttsApiKey or apiKey in AI settings.'));
            return;
        }
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
            output_format: {
                subtitle: true,
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
        if (createData.base_resp?.status_code !== 0) {
            console.error('MiniMax TTS error:', createData.base_resp?.status_msg);
            res.status(500).json(errorResponse('TTS_API_ERROR', createData.base_resp?.status_msg || 'Failed to create TTS task'));
            return;
        }
        const taskId = createData.task_id;
        if (!taskId) {
            res.status(500).json(errorResponse('TTS_API_ERROR', 'No task_id in response'));
            return;
        }
        // Poll for completion - reduced polling to avoid hitting API limits
        const pollResponse = await pollWithTimeout(async () => {
            try {
                const resp = await fetch(`https://api.minimaxi.com/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                });
                if (!resp.ok)
                    return null;
                return await resp.json();
            }
            catch {
                return null;
            }
        }, (result) => result.status?.toLowerCase() === 'success' || result.status?.toLowerCase() === 'fail', 5000, // 5 seconds between polls (was 3)
        30 // max 30 polls = 2.5 minutes max (was 100 = 5 minutes)
        );
        if (pollResponse.status?.toLowerCase() === 'fail') {
            res.status(500).json(errorResponse('TTS_API_ERROR', pollResponse.status_msg || 'TTS generation failed'));
            return;
        }
        // file_id is the audio file, subtitle_file_id is the subtitle file (per MiniMax API docs)
        if (!pollResponse.file_id) {
            res.status(500).json(errorResponse('TTS_API_ERROR', 'No file_id in response'));
            return;
        }
        // Download audio using file_id
        // Note: MiniMax returns a tar archive containing MP3 and subtitle files when subtitle is requested
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
        // Get the response as buffer
        const arrayBuffer = await downloadResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Extract MP3 and subtitle from tar archive, or use raw buffer if not a tar
        let audioBuffer;
        let subtitleText;
        if (isTarBuffer(buffer)) {
            // Extract from tar archive
            try {
                const result = await extractFromTar(buffer);
                audioBuffer = result.audioBuffer;
                subtitleText = result.subtitleText;
            }
            catch (err) {
                console.error('Failed to extract from tar:', err);
                res.status(500).json(errorResponse('TTS_API_ERROR', 'Failed to extract audio from download'));
                return;
            }
        }
        else {
            // Assume raw MP3 (MiniMax might return raw MP3 in some cases)
            console.log('Response is not a tar archive, using raw buffer as MP3');
            audioBuffer = buffer;
            // If the response happens to be JSON (error response), it will fail here
            if (audioBuffer.length < 1000) {
                // Likely an error message
                const text = audioBuffer.toString('utf-8');
                console.error('Unexpected response instead of audio:', text.substring(0, 500));
                res.status(500).json(errorResponse('TTS_API_ERROR', 'Failed to download audio: unexpected response'));
                return;
            }
        }
        // Convert MP3 binary to base64
        const audioBase64 = audioBuffer.toString('base64');
        // Parse subtitle text if available (extracted from tar archive as MiniMax JSON format)
        let sentenceData;
        if (subtitleText) {
            try {
                const sentences = parseMiniMaxTitles(subtitleText);
                sentenceData = sentenceTimingsToJSON(sentences);
                console.log(`Parsed ${sentences.length} sentences from subtitle`);
            }
            catch (err) {
                console.error('Failed to parse subtitle:', err);
                // Continue without subtitles - audio is still valid
            }
        }
        // Save to TTS table (upsert)
        await prisma.tTS.upsert({
            where: { articleId: id },
            update: {
                audioData: audioBase64,
                ...(sentenceData && { sentenceData }),
            },
            create: {
                articleId: id,
                audioData: audioBase64,
                ...(sentenceData && { sentenceData }),
            },
        });
        // Return sentence timings in response
        let sentences = [];
        if (sentenceData) {
            try {
                sentences = JSON.parse(sentenceData);
            }
            catch {
                sentences = [];
            }
        }
        res.json(successResponse({
            audioData: audioBase64,
            sentences,
        }));
        return;
    }
    catch (error) {
        console.error('Error generating TTS:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to generate TTS'));
        return;
    }
});
// GET /api/articles/:id/tts - Get TTS audio and sentence timings for an article
articlesRouter.get('/:id/tts', async (req, res) => {
    try {
        const id = req.params.id;
        const tts = await prisma.tTS.findUnique({
            where: { articleId: id },
        });
        if (!tts) {
            res.status(404).json(errorResponse('NOT_FOUND', 'TTS not found for this article'));
            return;
        }
        // Parse sentence timings if available
        let sentences = [];
        if (tts.sentenceData) {
            try {
                sentences = JSON.parse(tts.sentenceData);
            }
            catch {
                sentences = [];
            }
        }
        res.json(successResponse({
            audioData: tts.audioData,
            sentences,
        }));
        return;
    }
    catch (error) {
        console.error('Error getting TTS:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get TTS'));
        return;
    }
});
//# sourceMappingURL=articles.js.map