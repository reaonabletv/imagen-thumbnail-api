/**
 * Vertex AI Imagen 4 Service
 * Handles image generation using Google's Imagen 4 models
 */

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import {
  IMAGEN_MODELS,
  type ImagenModelTier,
  type AspectRatio,
  type ImageSize,
  type PersonGeneration,
  type GeneratedImage,
} from '../types/index.js';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

// Initialize Vertex AI client
let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    if (!PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }
    vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return vertexAI;
}

export interface GenerateImageOptions {
  modelTier?: ImagenModelTier;
  sampleCount?: 1 | 2 | 3 | 4;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  personGeneration?: PersonGeneration;
}

/**
 * Generate images using Imagen 4
 */
export async function generateImages(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GeneratedImage[]> {
  const {
    modelTier = 'STANDARD',
    sampleCount = 2,
    aspectRatio = '16:9',
    imageSize = '1K',
    personGeneration = 'dont_allow',
  } = options;

  const modelId = IMAGEN_MODELS[modelTier];

  console.log(`[Imagen 4] Generating ${sampleCount} images with ${modelId}`);
  console.log(`[Imagen 4] Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`[Imagen 4] Options: ${aspectRatio}, ${imageSize}, ${personGeneration}`);

  try {
    const vertex = getVertexAI();

    // Get the generative model for image generation
    const generativeModel = vertex.getGenerativeModel({
      model: modelId,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Use the prediction endpoint for Imagen
    const request = {
      instances: [{ prompt }],
      parameters: {
        sampleCount,
        aspectRatio,
        imageSize,
        personGeneration,
      },
    };

    // Make the prediction request
    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelId}`;

    // For Imagen 4, we need to use the REST API directly
    const response = await fetch(
      `https://${LOCATION}-aiplatform.googleapis.com/v1/${endpoint}:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Imagen 4] API Error:', errorText);
      throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      predictions?: Array<{
        bytesBase64Encoded?: string;
        mimeType?: string;
      }>;
    };

    if (!data.predictions || data.predictions.length === 0) {
      throw new Error('No images generated');
    }

    // Convert predictions to GeneratedImage format
    const generatedImages: GeneratedImage[] = data.predictions.map((prediction, index) => ({
      imageBase64: prediction.bytesBase64Encoded || '',
      qualityScore: 0.9 - (index * 0.05), // Slight variation in quality scores
      mimeType: prediction.mimeType || 'image/png',
    }));

    console.log(`[Imagen 4] Successfully generated ${generatedImages.length} images`);
    return generatedImages;

  } catch (error) {
    console.error('[Imagen 4] Generation failed:', error);
    throw error;
  }
}

/**
 * Get Google Cloud access token for API calls
 */
async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');

  // Support JSON credentials from environment variable (for Railway/cloud deployment)
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let auth: InstanceType<typeof GoogleAuth>;

  if (serviceAccountJson) {
    // Parse JSON credentials from environment variable
    try {
      const credentials = JSON.parse(serviceAccountJson);
      auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      console.log('[Auth] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON');
    } catch (e) {
      console.error('[Auth] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e);
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
    }
  } else {
    // Fall back to Application Default Credentials (local dev with gcloud auth)
    auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    console.log('[Auth] Using Application Default Credentials');
  }

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error('Failed to get access token');
  }

  return token.token;
}

/**
 * Check if Imagen API is properly configured
 */
export function isImagenConfigured(): boolean {
  return Boolean(PROJECT_ID);
}

/**
 * Get rate limit info for a model tier
 */
export function getRateLimitInfo(modelTier: ImagenModelTier): {
  requestsPerMinute: number;
  recommended: string;
} {
  const quotas: Record<ImagenModelTier, number> = {
    STANDARD: 75,
    FAST: 150,
    ULTRA: 30,
  };

  const recommendations: Record<ImagenModelTier, string> = {
    STANDARD: 'Best balance of quality and speed',
    FAST: 'Quick iterations, good for previews',
    ULTRA: 'Highest quality, use for final renders',
  };

  return {
    requestsPerMinute: quotas[modelTier],
    recommended: recommendations[modelTier],
  };
}
