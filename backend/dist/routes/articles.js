import { Router } from 'express';
import { prisma } from '../services/ai.js';
export const articlesRouter = Router();
// Helper function for response format
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(code, message) {
    return { success: false, error: { code, message } };
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
        res.json(successResponse(article));
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
//# sourceMappingURL=articles.js.map