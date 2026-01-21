/**
 * Lifestyle Compositing Service
 * Combines blur + gradient + product compositing for lifestyle thumbnails
 *
 * Pipeline:
 * 1. Apply Gaussian blur to background (dreamy effect)
 * 2. Apply radial gradient (spotlight on product)
 * 3. Composite product cutout at specified position
 */
import sharp from 'sharp';
import { applyGaussianBlur } from './blurService.js';
import { createRadialGradient, applyGradientOverlay, type PedestalPosition } from './gradientService.js';

// Standard YouTube thumbnail dimensions
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

// Default values
const DEFAULT_BLUR_RADIUS = 12;
const DEFAULT_GRADIENT_OPACITY = 0.25;

/**
 * Options for lifestyle compositing
 */
export interface LifestyleCompositingOptions {
  position: PedestalPosition;
  blurRadius?: number;
  gradientOpacity?: number;
}

/**
 * Result from lifestyle compositing
 */
export interface LifestyleCompositingResult {
  imageBase64: string;
  composited: boolean;
  position: { x: number; y: number; width: number; height: number };
}

/**
 * Calculate product position based on pedestal position and cutout dimensions
 */
function calculateProductPosition(
  pedestalPosition: PedestalPosition,
  cutoutWidth: number,
  cutoutHeight: number
): { x: number; y: number; width: number; height: number } {
  const cutoutAspect = cutoutWidth / cutoutHeight;

  // Target size: product should fill ~30-40% of frame width
  const targetWidth = Math.floor(THUMBNAIL_WIDTH * 0.35);

  let drawWidth: number;
  let drawHeight: number;

  // Calculate dimensions while maintaining aspect ratio
  if (cutoutAspect > 1) {
    // Wider than tall
    drawWidth = targetWidth;
    drawHeight = Math.floor(targetWidth / cutoutAspect);
    // Ensure it fits in frame
    if (drawHeight > THUMBNAIL_HEIGHT * 0.8) {
      drawHeight = Math.floor(THUMBNAIL_HEIGHT * 0.8);
      drawWidth = Math.floor(drawHeight * cutoutAspect);
    }
  } else {
    // Taller than wide (common for bottles)
    drawHeight = Math.floor(THUMBNAIL_HEIGHT * 0.85);
    drawWidth = Math.floor(drawHeight * cutoutAspect);
    // Ensure it fits in frame
    if (drawWidth > targetWidth) {
      drawWidth = targetWidth;
      drawHeight = Math.floor(drawWidth / cutoutAspect);
    }
  }

  // Ensure minimum size
  drawWidth = Math.max(drawWidth, 200);
  drawHeight = Math.max(drawHeight, 200);

  let x: number;
  let y: number;

  // Position based on pedestal position
  switch (pedestalPosition) {
    case 'center':
      x = Math.floor((THUMBNAIL_WIDTH - drawWidth) / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
      break;
    case 'center-bottom':
      x = Math.floor((THUMBNAIL_WIDTH - drawWidth) / 2);
      // Position product so it "sits" on pedestal at bottom third
      y = Math.floor(THUMBNAIL_HEIGHT * 0.65 - drawHeight);
      break;
    case 'right-third':
      x = Math.floor(THUMBNAIL_WIDTH * 0.67 - drawWidth / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
      break;
    case 'left-third':
      x = Math.floor(THUMBNAIL_WIDTH * 0.33 - drawWidth / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
      break;
    default:
      // Default to center
      x = Math.floor((THUMBNAIL_WIDTH - drawWidth) / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
  }

  // Ensure position is within bounds
  x = Math.max(20, Math.min(x, THUMBNAIL_WIDTH - drawWidth - 20));
  y = Math.max(20, Math.min(y, THUMBNAIL_HEIGHT - drawHeight - 20));

  return { x, y, width: drawWidth, height: drawHeight };
}

/**
 * Composite a lifestyle thumbnail with blur, gradient, and product
 *
 * @param backgroundBuffer - Background image buffer (will be blurred)
 * @param cutoutBuffer - Product cutout buffer (transparent PNG)
 * @param options - Compositing options (position, blur, gradient)
 * @returns Composited image as base64 with position info
 */
export async function compositeLifestyleThumbnail(
  backgroundBuffer: Buffer,
  cutoutBuffer: Buffer,
  options: LifestyleCompositingOptions
): Promise<LifestyleCompositingResult> {
  const {
    position,
    blurRadius = DEFAULT_BLUR_RADIUS,
    gradientOpacity = DEFAULT_GRADIENT_OPACITY,
  } = options;

  try {
    // Step 1: Resize background to thumbnail dimensions
    const resizedBackground = await sharp(backgroundBuffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
      .png()
      .toBuffer();

    // Step 2: Apply blur to background
    const blurredBackground = await applyGaussianBlur(resizedBackground, blurRadius);

    // Step 3: Create and apply gradient overlay
    const gradient = await createRadialGradient(
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT,
      position,
      gradientOpacity
    );
    const backgroundWithGradient = await applyGradientOverlay(blurredBackground, gradient);

    // Step 4: Get cutout metadata and calculate position
    const cutoutMetadata = await sharp(cutoutBuffer).metadata();
    const cutoutWidth = cutoutMetadata.width || 400;
    const cutoutHeight = cutoutMetadata.height || 400;
    const productPosition = calculateProductPosition(position, cutoutWidth, cutoutHeight);

    // Step 5: Resize cutout to target dimensions
    const resizedCutout = await sharp(cutoutBuffer)
      .resize(productPosition.width, productPosition.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Step 6: Composite cutout onto background
    const result = await sharp(backgroundWithGradient)
      .composite([
        {
          input: resizedCutout,
          top: productPosition.y,
          left: productPosition.x,
        },
      ])
      .png()
      .toBuffer();

    return {
      imageBase64: result.toString('base64'),
      composited: true,
      position: productPosition,
    };
  } catch (error) {
    console.error('[Lifestyle Compositing] Failed:', error);
    throw error;
  }
}
