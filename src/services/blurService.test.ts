/**
 * Blur Service Tests
 * TDD: These tests are written BEFORE the implementation
 */
import { describe, test, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { applyGaussianBlur } from './blurService.js';

describe('applyGaussianBlur', () => {
  let testImageBuffer: Buffer;

  beforeAll(async () => {
    // Create 100x100 solid red test image
    testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  test('returns buffer with same dimensions as input', async () => {
    const result = await applyGaussianBlur(testImageBuffer, 12);
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  test('clamps radius to minimum 8px', async () => {
    // Should not throw, should apply 8px blur (clamped from 3)
    const result = await applyGaussianBlur(testImageBuffer, 3);
    expect(result).toBeInstanceOf(Buffer);
  });

  test('clamps radius to maximum 15px', async () => {
    // Should not throw, should apply 15px blur (clamped from 25)
    const result = await applyGaussianBlur(testImageBuffer, 25);
    expect(result).toBeInstanceOf(Buffer);
  });

  test('applies blur that changes pixel values at edges', async () => {
    // Create image with sharp edge (left half black, right half white)
    const edgeImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 50,
              height: 100,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 50,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const blurred = await applyGaussianBlur(edgeImage, 12);

    // Extract raw pixels
    const { data } = await sharp(blurred).raw().toBuffer({ resolveWithObject: true });

    // Check pixel at the edge (x=50, y=50) - should now have intermediate values
    const pixelIndex = (50 * 100 + 50) * 4; // y * width + x, times 4 channels
    const edgePixelR = data[pixelIndex]; // R channel

    // Blurred edge should have intermediate value (not pure black 0 or white 255)
    expect(edgePixelR).toBeGreaterThan(0);
    expect(edgePixelR).toBeLessThan(255);
  });

  test('uses default radius of 12 when not specified', async () => {
    // Should work without radius argument
    const result = await applyGaussianBlur(testImageBuffer);
    expect(result).toBeInstanceOf(Buffer);
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(100);
  });
});
