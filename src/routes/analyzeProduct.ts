/**
 * Product Analysis Route
 * POST /api/analyze-product
 * Analyzes a product cutout image to extract lighting, colors, materials
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { analyzeProductImage, isGeminiConfigured } from '../services/geminiAnalysis.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Request validation schema
const analyzeProductSchema = z.object({
  cutoutBase64: z.string().min(100, 'Invalid image data'),
  productDescription: z.string().optional(),
});

/**
 * POST /api/analyze-product
 * Analyze a product cutout to determine optimal thumbnail generation parameters
 */
router.post('/', async (req: Request & AuthenticatedRequest, res: Response): Promise<void> => {
  console.log(`[Analyze Product] Request from user: ${req.userId || 'anonymous'}`);

  // Validate request body
  const parseResult = analyzeProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues.map(i => i.message),
    });
    return;
  }

  const { cutoutBase64, productDescription } = parseResult.data;

  // Check if Gemini is configured
  if (!isGeminiConfigured()) {
    res.status(503).json({
      error: 'Service unavailable',
      message: 'Product analysis service is not configured',
    });
    return;
  }

  try {
    console.log('[Analyze Product] Starting analysis...');
    const startTime = Date.now();

    const analysis = await analyzeProductImage(cutoutBase64, productDescription);

    const duration = Date.now() - startTime;
    console.log(`[Analyze Product] Completed in ${duration}ms`);

    res.json(analysis);

  } catch (error) {
    console.error('[Analyze Product] Error:', error);

    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;
