/**
 * Blur Service
 * Applies Gaussian blur to background images for lifestyle thumbnails
 *
 * Design Decision: Light blur (8-15px) keeps scene recognizable while
 * creating "dreamy" effect that draws focus to product
 */
import sharp from 'sharp';

// Blur range: 8-15px (scene stays recognizable but softened)
const MIN_BLUR_RADIUS = 8;
const MAX_BLUR_RADIUS = 15;
const DEFAULT_BLUR_RADIUS = 12;

/**
 * Apply Gaussian blur to an image buffer
 *
 * @param imageBuffer - Input image as Buffer
 * @param radius - Blur radius in pixels (clamped to 8-15px range)
 * @returns Blurred image as Buffer
 */
export async function applyGaussianBlur(
  imageBuffer: Buffer,
  radius: number = DEFAULT_BLUR_RADIUS
): Promise<Buffer> {
  // Clamp radius to valid range
  const clampedRadius = Math.max(MIN_BLUR_RADIUS, Math.min(MAX_BLUR_RADIUS, radius));

  return sharp(imageBuffer)
    .blur(clampedRadius)
    .toBuffer();
}
