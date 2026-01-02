/**
 * Contextual Thumbnail Generation Route
 * POST /api/generate-contextual-thumbnail
 * Generates lifestyle-aware thumbnails with Gemini-designed scenes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { generateImages, isImagenConfigured } from '../services/vertexAI.js';
import { compositeContextualThumbnail } from '../services/contextualCompositing.js';
import type {
  AuthenticatedRequest,
  ContextualThumbnailResponse,
  ImagenModelTier,
  AspectRatio,
  ImageSize,
} from '../types/index.js';

const router = Router();

// Scene design validation schema (matching frontend types)
const sceneDesignSchema = z.object({
  id: z.string(),
  environment: z.object({
    type: z.enum(['gym', 'kitchen', 'studio', 'office', 'outdoor', 'home', 'spa', 'garage', 'bathroom', 'bedroom']),
    description: z.string(),
    props: z.array(z.string()),
    lighting: z.object({
      type: z.enum(['dramatic', 'soft', 'natural', 'studio', 'golden-hour', 'neon']),
      direction: z.enum(['side', 'front', 'back', 'overhead', 'ambient']),
      intensity: z.enum(['high-contrast', 'balanced', 'low-key']),
    }),
  }),
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    textColor: z.string(),
    mood: z.enum(['energetic', 'premium', 'calm', 'natural', 'bold', 'elegant', 'playful']),
  }),
  pedestal: z.object({
    style: z.enum(['black-glossy', 'white-matte', 'glass', 'wooden', 'metal', 'floating', 'marble', 'concrete', 'none']),
    shape: z.enum(['circular', 'rectangular', 'hexagonal', 'organic', 'platform']),
    position: z.enum(['center', 'right-third', 'left-third', 'center-bottom']),
    hasReflection: z.boolean(),
    productSpaceRatio: z.number().min(0.2).max(0.6),
  }),
  textLayout: z.object({
    headline: z.object({
      text: z.string(),
      position: z.enum(['top-center', 'top-left', 'bottom-center', 'top-right']),
      style: z.enum(['bold-sans', 'impact', 'elegant-serif', 'modern-thin', 'brush']),
      size: z.enum(['large', 'xlarge', 'medium']),
    }),
    subheadline: z.object({
      text: z.string(),
      position: z.enum(['below-headline', 'bottom-center', 'above-headline']),
      style: z.enum(['regular', 'light', 'italic']),
    }).optional(),
    iconCallouts: z.array(z.object({
      iconDescription: z.string(),
      label: z.string(),
      position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left-side', 'right-side', 'around-product']),
      style: z.enum(['filled', 'outline', 'glow', 'circle-badge']),
    })),
  }),
  productCharacteristics: z.object({
    shapeDescription: z.string(),
    aspectRatio: z.enum(['tall', 'wide', 'square', 'cylindrical']),
    dominantColors: z.array(z.string()),
    surfaceType: z.enum(['matte', 'glossy', 'metallic', 'textured', 'transparent']),
  }),
  generatedPrompt: z.string().optional(),
  createdAt: z.number(),
});

// Request validation schema
const generateContextualThumbnailSchema = z.object({
  cutoutBase64: z.string().min(100, 'Invalid image data'),
  sceneDesign: sceneDesignSchema,
  imagenPrompt: z.string().min(50, 'Imagen prompt too short'),
  variations: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional(),
  modelTier: z.enum(['STANDARD', 'FAST', 'ULTRA']).optional(),
  imageSize: z.enum(['1K', '2K']).optional(),
});

/**
 * POST /api/generate-contextual-thumbnail
 * Generate contextual lifestyle thumbnails with scene-aware compositing
 */
router.post('/', async (req: Request & AuthenticatedRequest, res: Response): Promise<void> => {
  console.log(`[Contextual Thumbnail] Request from user: ${req.userId || 'anonymous'}`);

  // Validate request body
  const parseResult = generateContextualThumbnailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  const {
    cutoutBase64,
    sceneDesign,
    imagenPrompt,
    variations = 2,
    aspectRatio = '16:9',
    modelTier = 'STANDARD',
    imageSize = '1K',
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
    const startTime = Date.now();
    console.log(`[Contextual Thumbnail] Generating ${variations} variations with ${modelTier} tier`);
    console.log(`[Contextual Thumbnail] Scene: ${sceneDesign.environment.type} - ${sceneDesign.colorScheme.mood}`);
    console.log(`[Contextual Thumbnail] Headline: "${sceneDesign.textLayout.headline.text}"`);
    console.log(`[Contextual Thumbnail] Prompt (first 150 chars): ${imagenPrompt.substring(0, 150)}...`);

    // Generate contextual backgrounds with Imagen 4
    const generatedImages = await generateImages(imagenPrompt, {
      modelTier: modelTier as ImagenModelTier,
      sampleCount: variations,
      aspectRatio: aspectRatio as AspectRatio,
      imageSize: imageSize as ImageSize,
      personGeneration: 'dont_allow',
    });

    const generationDuration = Date.now() - startTime;
    console.log(`[Contextual Thumbnail] Generated ${generatedImages.length} backgrounds in ${generationDuration}ms`);

    // Composite product cutout onto each generated background using scene-aware positioning
    console.log(`[Contextual Thumbnail] Compositing with scene design...`);
    const compositingStartTime = Date.now();

    const compositedImages = [];
    for (const bg of generatedImages) {
      try {
        const result = await compositeContextualThumbnail(
          bg.imageBase64,
          cutoutBase64,
          sceneDesign
        );
        compositedImages.push({
          imageBase64: result.imageBase64,
          qualityScore: bg.qualityScore,
          mimeType: 'image/png',
          composited: true,
        });
        console.log(`[Contextual Thumbnail] ✓ Composited image ${compositedImages.length} at position (${result.position.x}, ${result.position.y})`);
      } catch (compError) {
        console.error(`[Contextual Thumbnail] Compositing failed for image ${compositedImages.length + 1}:`, compError);
        // Fall back to raw background (frontend will composite)
        compositedImages.push({
          ...bg,
          composited: false,
        });
      }
    }

    const compositingDuration = Date.now() - compositingStartTime;
    const totalDuration = Date.now() - startTime;
    console.log(`[Contextual Thumbnail] Compositing completed in ${compositingDuration}ms (total: ${totalDuration}ms)`);

    // Build response
    const response: ContextualThumbnailResponse = {
      id: uuidv4(),
      variations: compositedImages,
      sceneDesign,
      modelUsed: `imagen-4.0-${modelTier.toLowerCase()}-generate-001`,
    };

    res.json(response);

  } catch (error) {
    console.error('[Contextual Thumbnail] Error:', error);

    res.status(500).json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;
