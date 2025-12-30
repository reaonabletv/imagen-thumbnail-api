/**
 * Imagen 4 Thumbnail API
 * Railway-hosted microservice for AI-powered thumbnail generation
 *
 * Endpoints:
 * - POST /api/analyze-product - Analyze product cutout for optimal generation
 * - POST /api/generate-thumbnail - Generate photorealistic backgrounds with Imagen 4
 * - GET /health - Health check endpoint
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authenticateToken } from './middleware/auth.js';
import analyzeProductRouter from './routes/analyzeProduct.js';
import generateThumbnailRouter from './routes/generateThumbnail.js';
import { isImagenConfigured } from './services/vertexAI.js';
import { isGeminiConfigured } from './services/geminiAnalysis.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Parse allowed origins from environment
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim());

// ============================================================================
// Middleware
// ============================================================================

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing with increased limit for base64 images
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      imagen: isImagenConfigured() ? 'configured' : 'not configured',
      gemini: isGeminiConfigured() ? 'configured' : 'not configured',
    },
    version: '1.0.0',
    model: 'imagen-4.0',
  };

  res.json(status);
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Imagen 4 Thumbnail API',
    version: '1.0.0',
    endpoints: [
      {
        path: '/api/analyze-product',
        method: 'POST',
        description: 'Analyze a product cutout image',
        auth: 'required',
      },
      {
        path: '/api/generate-thumbnail',
        method: 'POST',
        description: 'Generate photorealistic thumbnail backgrounds',
        auth: 'required',
      },
    ],
    models: {
      standard: 'imagen-4.0-generate-001 (75 req/min)',
      fast: 'imagen-4.0-fast-generate-001 (150 req/min)',
      ultra: 'imagen-4.0-ultra-generate-001 (30 req/min)',
    },
  });
});

// Protected API routes
app.use('/api/analyze-product', authenticateToken, analyzeProductRouter);
app.use('/api/generate-thumbnail', authenticateToken, generateThumbnailRouter);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: ['/health', '/api', '/api/analyze-product', '/api/generate-thumbnail'],
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);

  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      error: 'CORS error',
      message: 'Origin not allowed',
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// ============================================================================
// Server Startup
// ============================================================================

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              Imagen 4 Thumbnail API                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Server running on port ${PORT}                                 ║`);
  console.log(`║ Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)}║`);
  console.log(`║ Imagen API: ${(isImagenConfigured() ? '✓ Configured' : '✗ Not configured').padEnd(45)}║`);
  console.log(`║ Gemini API: ${(isGeminiConfigured() ? '✓ Configured' : '✗ Not configured').padEnd(45)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ Endpoints:                                                 ║');
  console.log('║   GET  /health              - Health check                 ║');
  console.log('║   GET  /api                 - API info                     ║');
  console.log('║   POST /api/analyze-product - Analyze product image        ║');
  console.log('║   POST /api/generate-thumbnail - Generate with Imagen 4    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
});

export default app;
