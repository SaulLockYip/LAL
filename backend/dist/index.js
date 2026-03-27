import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as apiRouter } from './routes/index.js';
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 18080;
// Middleware
// CORS disabled for local-only access
app.use(cors({
    origin: false,
    credentials: false
}));
// JSON body parser
app.use(express.json());
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API routes
app.use('/api', apiRouter);
// Serve static files from frontend dist (production mode)
const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distPath));
// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});
// Start server
app.listen(PORT, () => {
    console.log(`LAL Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Frontend at http://localhost:${PORT}`);
});
export default app;
//# sourceMappingURL=index.js.map