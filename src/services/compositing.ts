/**
 * Compositing Service
 * Composites product cutouts onto AI-generated backgrounds using Sharp
 */

import sharp from 'sharp';

// Standard YouTube thumbnail dimensions
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

// Category-specific drop shadow settings (ported from Influencer-Studio's nanoBanana.ts)
const CATEGORY_SHADOWS: Record<string, { blur: number; offsetX: number; offsetY: number; opacity: number }> = {
  fitness: { blur: 25, offsetX: 8, offsetY: 15, opacity: 0.4 },
  supplements: { blur: 25, offsetX: 8, offsetY: 15, opacity: 0.4 },
  tech: { blur: 20, offsetX: 5, offsetY: 10, opacity: 0.3 },
  electronics: { blur: 20, offsetX: 5, offsetY: 10, opacity: 0.3 },
  beauty: { blur: 15, offsetX: 3, offsetY: 8, opacity: 0.2 },
  home: { blur: 20, offsetX: 5, offsetY: 12, opacity: 0.25 },
  food: { blur: 18, offsetX: 4, offsetY: 10, opacity: 0.3 },
  outdoor: { blur: 25, offsetX: 8, offsetY: 15, opacity: 0.35 },
  baby: { blur: 12, offsetX: 3, offsetY: 6, opacity: 0.15 },
  pet: { blur: 18, offsetX: 5, offsetY: 10, opacity: 0.3 },
  fashion: { blur: 15, offsetX: 4, offsetY: 8, opacity: 0.25 },
  lifestyle: { blur: 18, offsetX: 5, offsetY: 10, opacity: 0.25 },
  default: { blur: 20, offsetX: 5, offsetY: 10, opacity: 0.3 },
};

/**
 * Get shadow settings for a category
 */
function getShadowSettings(category?: string): typeof CATEGORY_SHADOWS['default'] {
  if (!category) return CATEGORY_SHADOWS.default;
  const normalized = category.toLowerCase();
  return CATEGORY_SHADOWS[normalized] || CATEGORY_SHADOWS.default;
}

export interface CompositingResult {
  imageBase64: string;
  composited: boolean;
}

/**
 * Composite product cutout onto AI-generated background
 *
 * Product is positioned on the right side of the thumbnail:
 * - Takes up ~45% of width
 * - 5% margin from right edge
 * - Vertically centered
 * - Category-appropriate drop shadow
 *
 * @param backgroundBase64 - AI-generated background image (base64, no prefix)
 * @param cutoutBase64 - Product cutout image (base64, no prefix)
 * @param category - Product category for shadow styling
 * @returns Composited image as base64 with composited flag
 */
export async function compositeProductOnBackground(
  backgroundBase64: string,
  cutoutBase64: string,
  category?: string
): Promise<CompositingResult> {
  try {
    // Decode images from base64
    const backgroundBuffer = Buffer.from(backgroundBase64, 'base64');
    const cutoutBuffer = Buffer.from(cutoutBase64, 'base64');

    // Get cutout metadata for aspect ratio calculation
    const cutoutMetadata = await sharp(cutoutBuffer).metadata();
    const cutoutWidth = cutoutMetadata.width || 400;
    const cutoutHeight = cutoutMetadata.height || 400;
    const aspectRatio = cutoutWidth / cutoutHeight;

    // Calculate target size (45% of thumbnail width, maintain aspect ratio)
    const targetWidth = Math.floor(THUMBNAIL_WIDTH * 0.45);
    let drawWidth: number;
    let drawHeight: number;

    if (aspectRatio > 1) {
      // Wider than tall
      drawWidth = Math.min(targetWidth, cutoutWidth);
      drawHeight = Math.floor(drawWidth / aspectRatio);
    } else {
      // Taller than wide
      drawHeight = Math.min(Math.floor(THUMBNAIL_HEIGHT * 0.85), cutoutHeight);
      drawWidth = Math.floor(drawHeight * aspectRatio);
    }

    // Ensure minimum size
    drawWidth = Math.max(drawWidth, 200);
    drawHeight = Math.max(drawHeight, 200);

    // Position: right side with 5% margin, vertically centered
    const x = THUMBNAIL_WIDTH - drawWidth - Math.floor(THUMBNAIL_WIDTH * 0.05);
    const y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);

    // Resize cutout to target dimensions
    const resizedCutout = await sharp(cutoutBuffer)
      .resize(drawWidth, drawHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Get shadow settings for category
    const shadow = getShadowSettings(category);

    // Create shadow layer by blurring and darkening the cutout
    const shadowBuffer = await sharp(resizedCutout)
      .grayscale()
      .modulate({ brightness: 0 }) // Make it black
      .blur(Math.max(shadow.blur, 0.3)) // Sharp requires blur >= 0.3
      .ensureAlpha(shadow.opacity)
      .toBuffer();

    // Resize background to exact thumbnail dimensions
    const resizedBackground = await sharp(backgroundBuffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
      .png()
      .toBuffer();

    // Composite: background + shadow + cutout
    const result = await sharp(resizedBackground)
      .composite([
        // Shadow layer (offset from cutout position)
        {
          input: shadowBuffer,
          top: Math.max(0, y + shadow.offsetY),
          left: Math.max(0, x + shadow.offsetX),
        },
        // Product cutout on top
        {
          input: resizedCutout,
          top: y,
          left: x,
        },
      ])
      .png()
      .toBuffer();

    return {
      imageBase64: result.toString('base64'),
      composited: true,
    };
  } catch (error) {
    console.error('[Compositing] Failed to composite product:', error);
    throw error;
  }
}
