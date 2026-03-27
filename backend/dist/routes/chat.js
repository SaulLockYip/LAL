import { Router } from 'express';
import { prisma, chatStreaming } from '../services/ai.js';
export const chatRouter = Router();
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}
// GET /api/chat - List all conversations (with message count)
chatRouter.get('/', async (req, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { messages: true },
                },
            },
        });
        const result = conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            articleId: conv.articleId,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv._count.messages,
        }));
        res.json(successResponse(result));
        return;
    }
    catch (error) {
        console.error('Error listing conversations:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list conversations'));
        return;
    }
});
// POST /api/chat - Create new conversation
chatRouter.post('/', async (req, res) => {
    try {
        const { title, articleId } = req.body;
        const conversation = await prisma.conversation.create({
            data: {
                title: title || null,
                articleId: articleId || null,
            },
        });
        res.json(successResponse(conversation));
        return;
    }
    catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create conversation'));
        return;
    }
});
// GET /api/chat/:id - Get conversation with messages
chatRouter.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const conversation = await prisma.conversation.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!conversation) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
            return;
        }
        // Return conversation and messages as separate top-level properties
        res.json(successResponse({
            conversation: {
                id: conversation.id,
                title: conversation.title,
                articleId: conversation.articleId,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            },
            messages: conversation.messages,
        }));
        return;
    }
    catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get conversation'));
        return;
    }
});
// DELETE /api/chat/:id - Delete conversation and all messages
chatRouter.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Check if conversation exists
        const conversation = await prisma.conversation.findUnique({
            where: { id },
        });
        if (!conversation) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
            return;
        }
        // Delete conversation (messages will be cascade deleted)
        await prisma.conversation.delete({
            where: { id },
        });
        res.json(successResponse({ deleted: true }));
        return;
    }
    catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete conversation'));
        return;
    }
});
// POST /api/chat/:id/messages - Add message to conversation (non-streaming)
chatRouter.post('/:id/messages', async (req, res) => {
    try {
        const id = req.params.id;
        const { role, content, model } = req.body;
        if (!role || !content) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'role and content are required'));
            return;
        }
        if (!['user', 'assistant', 'system'].includes(role)) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'role must be user, assistant, or system'));
            return;
        }
        // Check if conversation exists
        const conversation = await prisma.conversation.findUnique({
            where: { id },
        });
        if (!conversation) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
            return;
        }
        // Create the message
        const message = await prisma.message.create({
            data: {
                conversationId: id,
                role,
                content,
                model: model || null,
            },
        });
        // Update conversation's updatedAt
        await prisma.conversation.update({
            where: { id },
            data: { updatedAt: new Date() },
        });
        res.json(successResponse(message));
        return;
    }
    catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add message'));
        return;
    }
});
// POST /api/chat/stream - Streaming chat with conversation ID
chatRouter.post('/stream', async (req, res) => {
    try {
        const { conversationId, message, context } = req.body;
        if (!message) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'message is required'));
            return;
        }
        // Build context system message if provided
        let contextSystemMessage = null;
        if (context && context.type === 'article' && context.articleContent) {
            contextSystemMessage = `You are assisting with an article titled "${context.articleTitle || 'Untitled'}".\n\nArticle content:\n${context.articleContent}`;
        }
        else if (context && context.type === 'word_list' && context.wordList && context.wordList.length > 0) {
            contextSystemMessage = `You are assisting with vocabulary from a word list: ${context.wordList.join(', ')}`;
        }
        else if (context && context.type === 'exercises') {
            contextSystemMessage = 'You are assisting with language learning exercises.';
        }
        let effectiveConversationId = conversationId;
        // Create a new conversation if conversationId is not provided
        if (!effectiveConversationId) {
            const newConversation = await prisma.conversation.create({
                data: {
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                    articleId: null,
                },
            });
            effectiveConversationId = newConversation.id;
        }
        // Get conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: effectiveConversationId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!conversation) {
            res.status(404).json(errorResponse('NOT_FOUND', 'Conversation not found'));
            return;
        }
        // Get AI settings
        const aiSetting = await prisma.aISetting.findFirst({
            where: { name: 'default' },
        });
        if (!aiSetting || !aiSetting.apiKey) {
            res.status(400).json(errorResponse('AI_NOT_CONFIGURED', 'AI settings not configured'));
            return;
        }
        // Save user message
        const userMsg = await prisma.message.create({
            data: {
                conversationId: effectiveConversationId,
                role: 'user',
                content: message,
                model: null,
            },
        });
        // Build messages for AI
        const chatMessages = conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));
        // Inject context system message if provided
        if (contextSystemMessage) {
            chatMessages.push({ role: 'system', content: contextSystemMessage });
        }
        chatMessages.push({ role: 'user', content: message });
        // Set up SSE for streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        let fullResponse = '';
        await chatStreaming(chatMessages, {
            provider: aiSetting.provider,
            model: aiSetting.modelName,
            apiKey: aiSetting.apiKey,
            baseUrl: aiSetting.baseUrl,
        }, (chunk) => {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });
        // Save assistant message
        const assistantMsg = await prisma.message.create({
            data: {
                conversationId: effectiveConversationId,
                role: 'assistant',
                content: fullResponse,
                model: aiSetting.modelName,
            },
        });
        // Update conversation's updatedAt
        await prisma.conversation.update({
            where: { id: effectiveConversationId },
            data: { updatedAt: new Date() },
        });
        res.write(`data: ${JSON.stringify({ done: true, message: assistantMsg })}\n\n`);
        res.end();
        return;
    }
    catch (error) {
        console.error('Error in streaming chat:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json(errorResponse('AI_ERROR', message));
        return;
    }
});
//# sourceMappingURL=chat.js.map