/**
 * Thumbnail Generation Route
 * POST /api/generate-thumbnail
 * Generates photorealistic thumbnails using Imagen 4
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { generateImages, isImagenConfigured } from '../services/vertexAI.js';
import { generateBackgroundPrompt, generateInfographicPrompt } from '../services/geminiAnalysis.js';
import type {
  AuthenticatedRequest,
  AnalyzeProductResponse,
  GenerateThumbnailResponse,
  ImagenModelTier,
  AspectRatio,
  ImageSize,
} from '../types/index.js';

const router = Router();

// Request validation schema
const generateThumbnailSchema = z.object({
  cutoutBase64: z.string().min(100, 'Invalid image data'),
  analysis: z.object({
    lighting: z.object({
      angle: z.enum(['top-left', 'top-right', 'front', 'back', 'ambient']),
      intensity: z.enum(['soft', 'medium', 'harsh']),
      colorTemperature: z.enum(['warm', 'neutral', 'cool']),
    }),
    colors: z.object({
      dominant: z.string(),
      secondary: z.string(),
      accent: z.string(),
      palette: z.array(z.string()),
    }),
    material: z.object({
      surface: z.enum(['matte', 'glossy', 'metallic', 'textured', 'mixed']),
      reflectivity: z.number().min(0).max(1),
    }),
    shape: z.object({
      category: z.enum(['bottle', 'box', 'tube', 'irregular', 'cylindrical']),
      hasText: z.boolean(),
    }),
    recommendations: z.object({
      suggestedBackgrounds: z.array(z.string()),
      avoidColors: z.array(z.string()),
      pedestalStyle: z.enum(['none', 'simple', 'reflective', 'floating']),
    }),
  }),
  industryPrompt: z.string().min(1, 'Industry prompt required'),
  variations: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional(),
  modelTier: z.enum(['STANDARD', 'FAST', 'ULTRA']).optional(),
  imageSize: z.enum(['1K', '2K']).optional(),
  // Infographic options
  includeInfographic: z.boolean().optional(),
  infographic: z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    bulletPoints: z.array(z.string()),
    category: z.string(),
  }).optional(),
});

/**
 * POST /api/generate-thumbnail
 * Generate photorealistic thumbnail backgrounds using Imagen 4
 */
router.post('/', async (req: Request & AuthenticatedRequest, res: Response): Promise<void> => {
  console.log(`[Generate Thumbnail] Request from user: ${req.userId || 'anonymous'}`);

  // Validate request body
  const parseResult = generateThumbnailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  const {
    cutoutBase64,
    analysis,
    industryPrompt,
    variations = 2,
    aspectRatio = '16:9',
    modelTier = 'STANDARD',
    imageSize = '1K',
    includeInfographic = false,
    infographic,
  } = parseResult.data;

  // Check if Imagen is configured
  if (!isImagenConfigured()) {
    res.status(503).json({
      error: 'Service unavailable',
      message: 'Image generation service is not configured',
    });
    return;
  }

  try {
    console.log(`[Generate Thumbnail] Generating ${variations} variations with ${modelTier} tier`);
    console.log(`[Generate Thumbnail] Infographic mode: ${includeInfographic}`);
    const startTime = Date.now();

    // Generate the appropriate prompt based on whether we want infographics
    let thumbnailPrompt: string;

    if (includeInfographic && infographic) {
      // Use infographic prompt with text in image
      thumbnailPrompt = generateInfographicPrompt(
        analysis as AnalyzeProductResponse,
        industryPrompt,
        infographic
      );
      console.log(`[Generate Thumbnail] Using infographic prompt with headline: "${infographic.headline}"`);
    } else {
      // Use standard background-only prompt
      thumbnailPrompt = generateBackgroundPrompt(analysis as AnalyzeProductResponse, industryPrompt);
    }

    console.log(`[Generate Thumbnail] Prompt: ${thumbnailPrompt.substring(0, 100)}...`);

    // Generate images with Imagen 4
    const generatedImages = await generateImages(thumbnailPrompt, {
      modelTier: modelTier as ImagenModelTier,
      sampleCount: variations,
      aspectRatio: aspectRatio as AspectRatio,
      imageSize: imageSize as ImageSize,
      personGeneration: 'dont_allow', // Never generate people in product backgrounds
    });

    const duration = Date.now() - startTime;
    console.log(`[Generate Thumbnail] Generated ${generatedImages.length} images in ${duration}ms`);

    // Build response
    const response: GenerateThumbnailResponse = {
      id: uuidv4(),
      variations: generatedImages,
      analysis: analysis as AnalyzeProductResponse,
      modelUsed: `imagen-4.0-${modelTier.toLowerCase()}-generate-001`,
    };

    res.json(response);

  } catch (error) {
    console.error('[Generate Thumbnail] Error:', error);

    res.status(500).json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;
