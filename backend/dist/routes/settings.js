import { Router } from 'express';
import { prisma, chat } from '../services/ai.js';
export const settingsRouter = Router();
// Test AI connection
async function testAIConnection(provider, model, apiKey, baseUrl) {
    try {
        const messages = [{ role: 'user', content: 'Hi, please reply with "OK" if you can read this.' }];
        if (provider === 'openai') {
            await chat(messages, { provider: 'openai', model, apiKey, baseUrl });
        }
        else {
            await chat(messages, { provider: 'anthropic', model, apiKey, baseUrl });
        }
        return { success: true, message: 'Connection successful!' };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Connection failed: ${message}` };
    }
}
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}
// GET /api/settings/user - Get user config
settingsRouter.get('/user', async (_req, res) => {
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            res.json(successResponse({
                id: null,
                name: '',
                nativeLanguage: 'Chinese',
                targetLanguage: 'English',
                currentLevel: 'A2',
            }));
            return;
        }
        res.json(successResponse(user));
        return;
    }
    catch (error) {
        console.error('Error getting user settings:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get user settings'));
        return;
    }
});
// PUT /api/settings/user - Update user config
settingsRouter.put('/user', async (req, res) => {
    try {
        const { name, nativeLanguage, targetLanguage, currentLevel } = req.body;
        // Validate required fields
        if (!nativeLanguage || !targetLanguage || !currentLevel) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'nativeLanguage, targetLanguage, and currentLevel are required'));
            return;
        }
        // Find existing user or create new one
        const existingUser = await prisma.user.findFirst();
        let user;
        if (existingUser) {
            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    name: name || existingUser.name,
                    nativeLanguage,
                    targetLanguage,
                    currentLevel,
                },
            });
        }
        else {
            user = await prisma.user.create({
                data: {
                    name: name || 'User',
                    nativeLanguage,
                    targetLanguage,
                    currentLevel,
                },
            });
        }
        res.json(successResponse(user));
        return;
    }
    catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update user settings'));
        return;
    }
});
// GET /api/settings/ai - Get AI settings
settingsRouter.get('/ai', async (_req, res) => {
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
    }
    catch (error) {
        console.error('Error getting AI settings:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get AI settings'));
        return;
    }
});
// PUT /api/settings/ai - Update AI settings
settingsRouter.put('/ai', async (req, res) => {
    try {
        const { provider, modelName, baseUrl, apiKey } = req.body;
        // Validate required fields
        if (!provider || !modelName || !baseUrl) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'provider, modelName, and baseUrl are required'));
            return;
        }
        // Validate provider
        if (provider !== 'openai' && provider !== 'anthropic') {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'provider must be "openai" or "anthropic"'));
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
        }
        else {
            if (!apiKey) {
                res.status(400).json(errorResponse('VALIDATION_ERROR', 'apiKey is required for new AI settings'));
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
    }
    catch (error) {
        console.error('Error updating AI settings:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update AI settings'));
        return;
    }
});
// POST /api/settings/ai/test - Test AI connection
settingsRouter.post('/ai/test', async (req, res) => {
    try {
        const { provider, modelName, apiKey, baseUrl } = req.body;
        if (!provider || !modelName || !apiKey || !baseUrl) {
            res.status(400).json(errorResponse('VALIDATION_ERROR', 'provider, modelName, apiKey, and baseUrl are required'));
            return;
        }
        const result = await testAIConnection(provider, modelName, apiKey, baseUrl);
        res.json(successResponse(result));
        return;
    }
    catch (error) {
        console.error('Error testing AI connection:', error);
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to test AI connection'));
        return;
    }
});
//# sourceMappingURL=settings.js.map