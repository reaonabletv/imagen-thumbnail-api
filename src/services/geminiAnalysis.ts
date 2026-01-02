/**
 * Gemini Analysis Service
 * Uses Gemini to analyze product images for optimal thumbnail generation
 */

import { GoogleGenAI } from '@google/genai';
import type {
  AnalyzeProductResponse,
  LightingAnalysis,
  ColorAnalysis,
  MaterialAnalysis,
  ShapeAnalysis,
  Recommendations,
} from '../types/index.js';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

let genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genai) {
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY environment variable is required for product analysis');
    }
    genai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  }
  return genai;
}

const ANALYSIS_PROMPT = `Analyze this product image and provide a detailed analysis for AI thumbnail generation.

Return a JSON object with exactly this structure:
{
  "lighting": {
    "angle": "top-left" | "top-right" | "front" | "back" | "ambient",
    "intensity": "soft" | "medium" | "harsh",
    "colorTemperature": "warm" | "neutral" | "cool"
  },
  "colors": {
    "dominant": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor",
    "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"]
  },
  "material": {
    "surface": "matte" | "glossy" | "metallic" | "textured" | "mixed",
    "reflectivity": 0.0-1.0
  },
  "shape": {
    "category": "bottle" | "box" | "tube" | "irregular" | "cylindrical",
    "hasText": true | false
  },
  "recommendations": {
    "suggestedBackgrounds": ["description1", "description2", "description3"],
    "avoidColors": ["#hex1", "#hex2"],
    "pedestalStyle": "none" | "simple" | "reflective" | "floating"
  }
}

Analyze:
1. LIGHTING: Determine the primary light source direction, intensity, and color temperature
2. COLORS: Extract the dominant colors from the product itself
3. MATERIAL: Identify the surface material and reflectivity
4. SHAPE: Categorize the overall product shape
5. RECOMMENDATIONS: Suggest complementary backgrounds that won't clash with the product

Return ONLY the JSON object, no markdown or explanation.`;

/**
 * Analyze a product cutout image using Gemini
 */
export async function analyzeProductImage(
  cutoutBase64: string,
  productDescription?: string
): Promise<AnalyzeProductResponse> {
  console.log('[Gemini Analysis] Starting product analysis...');

  const ai = getGenAI();

  const prompt = productDescription
    ? `${ANALYSIS_PROMPT}\n\nProduct description: ${productDescription}`
    : ANALYSIS_PROMPT;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: cutoutBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Gemini Analysis] Invalid response:', text);
      throw new Error('Failed to parse analysis response');
    }

    const analysis = JSON.parse(jsonMatch[0]) as AnalyzeProductResponse;

    // Validate the response structure
    validateAnalysisResponse(analysis);

    console.log('[Gemini Analysis] Analysis complete');
    return analysis;

  } catch (error) {
    console.error('[Gemini Analysis] Error:', error);

    // Return a default analysis on error
    return getDefaultAnalysis();
  }
}

/**
 * Validate that the analysis response has all required fields
 */
function validateAnalysisResponse(analysis: AnalyzeProductResponse): void {
  const requiredFields = ['lighting', 'colors', 'material', 'shape', 'recommendations'];

  for (const field of requiredFields) {
    if (!(field in analysis)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate nested fields
  if (!analysis.lighting.angle || !analysis.lighting.intensity || !analysis.lighting.colorTemperature) {
    throw new Error('Invalid lighting analysis');
  }

  if (!analysis.colors.dominant || !analysis.colors.palette) {
    throw new Error('Invalid color analysis');
  }
}

/**
 * Get default analysis when Gemini fails
 */
function getDefaultAnalysis(): AnalyzeProductResponse {
  return {
    lighting: {
      angle: 'front',
      intensity: 'medium',
      colorTemperature: 'neutral',
    },
    colors: {
      dominant: '#808080',
      secondary: '#A0A0A0',
      accent: '#606060',
      palette: ['#808080', '#A0A0A0', '#606060', '#C0C0C0', '#404040'],
    },
    material: {
      surface: 'matte',
      reflectivity: 0.3,
    },
    shape: {
      category: 'box',
      hasText: true,
    },
    recommendations: {
      suggestedBackgrounds: [
        'Clean white studio background with soft shadows',
        'Gradient blue to white professional backdrop',
        'Minimalist gray surface with ambient lighting',
      ],
      avoidColors: ['#FF0000', '#00FF00'], // Avoid clashing colors
      pedestalStyle: 'simple',
    },
  };
}

/**
 * Generate a background prompt based on analysis
 */
export function generateBackgroundPrompt(
  analysis: AnalyzeProductResponse,
  industryPrompt: string
): string {
  const { lighting, colors, recommendations } = analysis;

  // Build a detailed prompt for Imagen
  const lightingDesc = `${lighting.intensity} ${lighting.colorTemperature} lighting from ${lighting.angle}`;
  const colorContext = `complementary to ${colors.dominant} dominant color`;
  const backgroundSuggestion = recommendations.suggestedBackgrounds[0] || 'professional studio backdrop';

  return `A photorealistic product photography background for ${industryPrompt}.
${backgroundSuggestion}.
${lightingDesc}.
${colorContext}.
Clean, professional, high-end commercial look.
No product in frame - background only.
8K quality, studio lighting, ${recommendations.pedestalStyle === 'reflective' ? 'reflective surface' : 'matte surface'}.
Do not include any text, logos, watermarks, or branding.`;
}

/**
 * Generate a thumbnail prompt WITH infographics (text in image)
 */
export function generateInfographicPrompt(
  analysis: AnalyzeProductResponse,
  industryPrompt: string,
  infographic: {
    headline: string;
    subheadline?: string;
    bulletPoints: string[];
    category: string;
  }
): string {
  const { lighting, colors, recommendations } = analysis;

  // Category-specific background suggestions
  const categoryBackgrounds: Record<string, string> = {
    supplements: 'gym environment with weights and fitness equipment in background, dramatic lighting',
    fitness: 'modern gym setting with exercise equipment, motivational atmosphere',
    beauty: 'elegant spa-like setting with soft pink and gold accents',
    electronics: 'sleek modern desk setup with tech gadgets, cool blue lighting',
    food: 'rustic kitchen setting with fresh ingredients, warm inviting lighting',
    health: 'clean medical/wellness environment, bright and trustworthy',
    fashion: 'minimalist studio with fashion photography lighting',
    home: 'cozy living space with natural lighting',
    default: 'professional product photography studio backdrop',
  };

  const backgroundStyle = categoryBackgrounds[infographic.category.toLowerCase()] || categoryBackgrounds.default;

  // Build bullet points text for the prompt
  const bulletText = infographic.bulletPoints.slice(0, 3).join(', ');

  return `A photorealistic Amazon product thumbnail infographic for ${industryPrompt}.

BACKGROUND: ${backgroundStyle}. ${lighting.intensity} ${lighting.colorTemperature} lighting.

LAYOUT: Professional e-commerce infographic style with:
- Large bold headline text: "${infographic.headline}"
${infographic.subheadline ? `- Subheadline: "${infographic.subheadline}"` : ''}
- Key benefits displayed as clean text overlays: ${bulletText}

STYLE: High-end commercial photography meets informational graphic.
Clean sans-serif typography, easy to read.
Colors that complement ${colors.dominant}.
Professional Amazon listing thumbnail aesthetic.
Product feature callouts with clean icons or text badges.

IMPORTANT: Make text legible and professionally designed.
8K quality, commercial photography lighting.
Do not include product image - leave space for product to be composited.
Do not add watermarks or unrelated logos.`;
}

/**
 * Extract product information from script content
 */
export async function extractProductInfo(
  scriptContent: string,
  productDescription?: string
): Promise<{
  productName: string;
  category: string;
  keyBenefits: string[];
  specs: string[];
  suggestedHeadline: string;
  suggestedSubheadline: string;
}> {
  console.log('[Gemini Analysis] Extracting product info from script...');

  const ai = getGenAI();

  const prompt = `Analyze this product script/description and extract key information for creating a thumbnail infographic.

${productDescription ? `Product Description: ${productDescription}\n` : ''}
Script Content:
${scriptContent}

Return a JSON object with:
{
  "productName": "Product name",
  "category": "supplements" | "fitness" | "beauty" | "electronics" | "food" | "health" | "fashion" | "home" | "other",
  "keyBenefits": ["benefit1", "benefit2", "benefit3"] (max 3, short phrases),
  "specs": ["spec1", "spec2"] (e.g., "20 Servings", "150mg Caffeine"),
  "suggestedHeadline": "Short punchy headline for thumbnail (3-5 words)",
  "suggestedSubheadline": "Secondary text (2-4 words)"
}

Focus on compelling, Amazon-thumbnail-style copy. Keep benefits SHORT (2-4 words each).
Return ONLY the JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.3, maxOutputTokens: 512 },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse response');

    const info = JSON.parse(jsonMatch[0]);
    console.log('[Gemini Analysis] Extracted product info:', info.productName);
    return info;

  } catch (error) {
    console.error('[Gemini Analysis] Extraction failed:', error);
    // Return defaults
    return {
      productName: 'Product',
      category: 'other',
      keyBenefits: ['Premium Quality', 'Best Value', 'Top Rated'],
      specs: [],
      suggestedHeadline: 'Premium Choice',
      suggestedSubheadline: 'Best Seller',
    };
  }
}

/**
 * Check if Gemini API is configured
 */
export function isGeminiConfigured(): boolean {
  return Boolean(GOOGLE_API_KEY);
}
