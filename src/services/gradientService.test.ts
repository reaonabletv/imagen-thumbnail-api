/**
 * Gradient Service Tests
 * TDD: These tests are written BEFORE the implementation
 */
import { describe, test, expect } from 'vitest';
import sharp from 'sharp';
import {
  createRadialGradient,
  applyGradientOverlay,
  type PedestalPosition,
} from './gradientService.js';

describe('createRadialGradient', () => {
  test('creates SVG buffer with correct dimensions', async () => {
    const gradient = await createRadialGradient(1280, 720, 'center', 0.25);
    expect(gradient).toBeInstanceOf(Buffer);
    const svgString = gradient.toString();
    expect(svgString).toContain('width="1280"');
    expect(svgString).toContain('height="720"');
  });

  test('centers gradient for center position', async () => {
    const gradient = await createRadialGradient(1280, 720, 'center', 0.25);
    const svg = gradient.toString();
    expect(svg).toContain('cx="0.5"');
  });

  test('offsets gradient for right-third position', async () => {
    const gradient = await createRadialGradient(1280, 720, 'right-third', 0.25);
    const svg = gradient.toString();
    expect(svg).toContain('cx="0.67"');
  });

  test('offsets gradient for left-third position', async () => {
    const gradient = await createRadialGradient(1280, 720, 'left-third', 0.25);
    const svg = gradient.toString();
    expect(svg).toContain('cx="0.33"');
  });

  test('offsets gradient for center-bottom position', async () => {
    const gradient = await createRadialGradient(1280, 720, 'center-bottom', 0.25);
    const svg = gradient.toString();
    expect(svg).toContain('cx="0.5"');
    expect(svg).toContain('cy="0.7"');
  });

  test('applies specified opacity in hex format', async () => {
    // 0.25 opacity = 64 in decimal = 40 in hex
    const gradient = await createRadialGradient(1280, 720, 'center', 0.25);
    const svg = gradient.toString();
    // Check that stop-color contains opacity in hex
    expect(svg).toMatch(/stop-color="#00000040"/);
  });

  test('clamps opacity to 0.20 minimum', async () => {
    const gradient = await createRadialGradient(1280, 720, 'center', 0.10);
    const svg = gradient.toString();
    // 0.20 opacity = 51 in decimal = 33 in hex
    expect(svg).toMatch(/stop-color="#00000033"/);
  });

  test('clamps opacity to 0.30 maximum', async () => {
    const gradient = await createRadialGradient(1280, 720, 'center', 0.50);
    const svg = gradient.toString();
    // 0.30 opacity = 77 in decimal = 4d in hex
    expect(svg).toMatch(/stop-color="#0000004d"/i);
  });
});

describe('applyGradientOverlay', () => {
  test('composites gradient onto image with same dimensions', async () => {
    const baseImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const gradient = await createRadialGradient(100, 100, 'center', 0.25);
    const result = await applyGradientOverlay(baseImage, gradient);

    expect(result).toBeInstanceOf(Buffer);
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  test('darkens edges more than center (radial vignette effect)', async () => {
    const whiteImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const gradient = await createRadialGradient(100, 100, 'center', 0.25);
    const result = await applyGradientOverlay(whiteImage, gradient);

    const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });

    // Get pixel at center (50, 50) and corner (0, 0)
    const centerIndex = (50 * info.width + 50) * info.channels;
    const cornerIndex = 0; // Top-left corner

    const centerPixelR = data[centerIndex];
    const cornerPixelR = data[cornerIndex];

    // Corner should be darker than center (radial gradient creates vignette)
    expect(cornerPixelR).toBeLessThan(centerPixelR);
  });

  test('preserves image format as PNG', async () => {
    const baseImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const gradient = await createRadialGradient(100, 100, 'center', 0.25);
    const result = await applyGradientOverlay(baseImage, gradient);

    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('png');
  });
});
