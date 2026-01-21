/**
 * Gradient Service
 * Creates radial gradient overlays for spotlight effect on lifestyle thumbnails
 *
 * Design Decision: Subtle radial gradient (20-30% opacity) creates
 * a "spotlight" effect that draws focus to the product without
 * being distracting
 */
import sharp from 'sharp';

// Opacity range: 20-30% (subtle vignette, not overpowering)
const MIN_OPACITY = 0.20;
const MAX_OPACITY = 0.30;
const DEFAULT_OPACITY = 0.25;

/**
 * Pedestal position determines where the gradient centers
 * to create spotlight effect on product placement area
 */
export type PedestalPosition = 'center' | 'right-third' | 'left-third' | 'center-bottom';

/**
 * Position mapping for gradient center based on product placement
 */
const POSITION_MAP: Record<PedestalPosition, { cx: number; cy: number }> = {
  'center': { cx: 0.5, cy: 0.55 },
  'right-third': { cx: 0.67, cy: 0.55 },
  'left-third': { cx: 0.33, cy: 0.55 },
  'center-bottom': { cx: 0.5, cy: 0.7 },
};

/**
 * Create a radial gradient SVG buffer for spotlight effect
 *
 * The gradient is transparent at center and darkens toward edges,
 * creating a natural vignette that draws attention to the product
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param position - Where to center the spotlight (product position)
 * @param opacity - Edge darkness (0.20-0.30, clamped)
 * @returns SVG gradient as Buffer
 */
export async function createRadialGradient(
  width: number,
  height: number,
  position: PedestalPosition,
  opacity: number = DEFAULT_OPACITY
): Promise<Buffer> {
  const { cx, cy } = POSITION_MAP[position];

  // Clamp opacity to valid range
  const clampedOpacity = Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, opacity));

  // Convert opacity to hex (e.g., 0.25 -> 64 -> "40")
  const opacityHex = Math.round(clampedOpacity * 255)
    .toString(16)
    .padStart(2, '0');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="spotlight" cx="${cx}" cy="${cy}" r="0.7">
      <stop offset="0%" stop-color="transparent" />
      <stop offset="60%" stop-color="transparent" />
      <stop offset="100%" stop-color="#000000${opacityHex}" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#spotlight)" />
</svg>`;

  return Buffer.from(svg);
}

/**
 * Apply gradient overlay to an image
 *
 * Composites the radial gradient SVG over the base image
 * to create the spotlight/vignette effect
 *
 * @param imageBuffer - Base image as Buffer
 * @param gradientSvg - Gradient SVG as Buffer (from createRadialGradient)
 * @returns Composited image as Buffer
 */
export async function applyGradientOverlay(
  imageBuffer: Buffer,
  gradientSvg: Buffer
): Promise<Buffer> {
  return sharp(imageBuffer)
    .composite([{ input: gradientSvg, blend: 'over' }])
    .png()
    .toBuffer();
}
