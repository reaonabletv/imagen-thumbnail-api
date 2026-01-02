/**
 * Contextual Compositing Service
 * Composites product cutouts onto contextual lifestyle backgrounds
 * with pedestal-aware positioning based on scene design
 */

import sharp from 'sharp';
import type { SceneDesign, PedestalPosition } from '../types/index.js';

// Standard YouTube thumbnail dimensions
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

/**
 * Category-specific drop shadow settings
 */
const SHADOW_PRESETS = {
  // Dark backgrounds need lighter shadows
  dark: { blur: 30, offsetX: 0, offsetY: 20, opacity: 0.5 },
  // Light backgrounds need darker shadows
  light: { blur: 25, offsetX: 5, offsetY: 15, opacity: 0.4 },
  // Dramatic lighting needs strong shadows
  dramatic: { blur: 35, offsetX: 10, offsetY: 25, opacity: 0.6 },
  // Soft lighting needs subtle shadows
  soft: { blur: 15, offsetX: 3, offsetY: 8, opacity: 0.2 },
  // Default
  default: { blur: 20, offsetX: 5, offsetY: 12, opacity: 0.35 },
};

export interface ContextualCompositingResult {
  imageBase64: string;
  composited: boolean;
  position: { x: number; y: number; width: number; height: number };
}

/**
 * Get shadow settings based on scene design
 */
function getShadowFromDesign(design: SceneDesign): typeof SHADOW_PRESETS['default'] {
  const { environment, colorScheme } = design;

  // Determine if background is dark or light
  const bgColor = colorScheme.background;
  const isDarkBg =
    bgColor.toLowerCase() === '#000000' ||
    bgColor.toLowerCase().includes('1c1c1e') ||
    colorScheme.mood === 'bold' ||
    colorScheme.mood === 'energetic';

  // Determine lighting style
  const lightingType = environment.lighting.type;
  const lightingIntensity = environment.lighting.intensity;

  if (lightingType === 'dramatic' || lightingType === 'neon') {
    return SHADOW_PRESETS.dramatic;
  }
  if (lightingType === 'soft' || lightingIntensity === 'low-key') {
    return SHADOW_PRESETS.soft;
  }
  if (isDarkBg) {
    return SHADOW_PRESETS.dark;
  }
  if (!isDarkBg) {
    return SHADOW_PRESETS.light;
  }

  return SHADOW_PRESETS.default;
}

/**
 * Calculate product position based on pedestal design
 */
function calculateProductPosition(
  pedestalPosition: PedestalPosition,
  productSpaceRatio: number,
  cutoutWidth: number,
  cutoutHeight: number
): { x: number; y: number; width: number; height: number } {
  const targetWidth = Math.floor(THUMBNAIL_WIDTH * productSpaceRatio);
  const cutoutAspect = cutoutWidth / cutoutHeight;

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
      x = Math.floor(THUMBNAIL_WIDTH * 0.65 - drawWidth / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
      break;
    case 'left-third':
      x = Math.floor(THUMBNAIL_WIDTH * 0.35 - drawWidth / 2);
      y = Math.floor((THUMBNAIL_HEIGHT - drawHeight) / 2);
      break;
    default:
      // Default to center-bottom (most common for product thumbnails)
      x = Math.floor((THUMBNAIL_WIDTH - drawWidth) / 2);
      y = Math.floor(THUMBNAIL_HEIGHT * 0.65 - drawHeight);
  }

  // Ensure position is within bounds
  x = Math.max(20, Math.min(x, THUMBNAIL_WIDTH - drawWidth - 20));
  y = Math.max(20, Math.min(y, THUMBNAIL_HEIGHT - drawHeight - 20));

  return { x, y, width: drawWidth, height: drawHeight };
}

/**
 * Composite product cutout onto contextual lifestyle background
 *
 * Uses scene design to determine:
 * - Product position based on pedestal design
 * - Shadow intensity based on lighting
 * - Overall positioning for text/icon space
 *
 * @param backgroundBase64 - AI-generated contextual background (base64, no prefix)
 * @param cutoutBase64 - Product cutout image (base64, no prefix)
 * @param sceneDesign - Scene design with pedestal and lighting info
 * @returns Composited image as base64 with position info
 */
export async function compositeContextualThumbnail(
  backgroundBase64: string,
  cutoutBase64: string,
  sceneDesign: SceneDesign
): Promise<ContextualCompositingResult> {
  try {
    // Decode images from base64
    const backgroundBuffer = Buffer.from(backgroundBase64, 'base64');
    const cutoutBuffer = Buffer.from(cutoutBase64, 'base64');

    // Get cutout metadata
    const cutoutMetadata = await sharp(cutoutBuffer).metadata();
    const cutoutWidth = cutoutMetadata.width || 400;
    const cutoutHeight = cutoutMetadata.height || 400;

    // Calculate position based on scene design
    const { pedestal } = sceneDesign;
    const position = calculateProductPosition(
      pedestal.position,
      pedestal.productSpaceRatio,
      cutoutWidth,
      cutoutHeight
    );

    // Resize cutout to target dimensions
    const resizedCutout = await sharp(cutoutBuffer)
      .resize(position.width, position.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Get shadow settings from scene design
    const shadow = getShadowFromDesign(sceneDesign);

    // Create shadow layer
    const shadowBuffer = await sharp(resizedCutout)
      .grayscale()
      .modulate({ brightness: 0 }) // Make it black
      .blur(Math.max(shadow.blur, 0.3))
      .ensureAlpha(shadow.opacity)
      .toBuffer();

    // Resize background to exact thumbnail dimensions
    const resizedBackground = await sharp(backgroundBuffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover' })
      .png()
      .toBuffer();

    // Create reflection if pedestal has reflection
    let compositeInputs = [];

    // Add shadow
    compositeInputs.push({
      input: shadowBuffer,
      top: Math.max(0, position.y + shadow.offsetY),
      left: Math.max(0, position.x + shadow.offsetX),
    });

    // Add reflection for pedestals that have it
    if (pedestal.hasReflection && pedestal.position === 'center-bottom') {
      try {
        // Create a flipped, faded reflection
        const reflectionBuffer = await sharp(resizedCutout)
          .flip() // Vertical flip
          .modulate({ brightness: 0.3 }) // Darken
          .blur(3)
          .ensureAlpha(0.3) // Make semi-transparent
          .toBuffer();

        // Position reflection below product
        compositeInputs.push({
          input: reflectionBuffer,
          top: Math.min(THUMBNAIL_HEIGHT - 50, position.y + position.height),
          left: position.x,
        });
      } catch (reflectionError) {
        console.warn('[Contextual Compositing] Reflection generation failed, skipping:', reflectionError);
      }
    }

    // Add the product cutout on top
    compositeInputs.push({
      input: resizedCutout,
      top: position.y,
      left: position.x,
    });

    // Composite all layers
    const result = await sharp(resizedBackground)
      .composite(compositeInputs)
      .png()
      .toBuffer();

    return {
      imageBase64: result.toString('base64'),
      composited: true,
      position,
    };
  } catch (error) {
    console.error('[Contextual Compositing] Failed to composite product:', error);
    throw error;
  }
}
