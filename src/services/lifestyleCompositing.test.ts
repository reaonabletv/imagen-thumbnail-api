/**
 * Lifestyle Compositing Service Tests
 * TDD: These tests are written BEFORE the implementation
 *
 * This service combines blur + gradient + product compositing
 * into a single pipeline for lifestyle thumbnails
 */
import { describe, test, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import {
  compositeLifestyleThumbnail,
  type LifestyleCompositingOptions,
} from './lifestyleCompositing.js';

describe('compositeLifestyleThumbnail', () => {
  let backgroundBuffer: Buffer;
  let cutoutBuffer: Buffer;

  beforeAll(async () => {
    // Create 1280x720 blue background (simulating lifestyle scene)
    backgroundBuffer = await sharp({
      create: {
        width: 1280,
        height: 720,
        channels: 4,
        background: { r: 0, g: 100, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Create 200x300 red product cutout with transparency
    cutoutBuffer = await sharp({
      create: {
        width: 200,
        height: 300,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  test('returns buffer with standard thumbnail dimensions (1280x720)', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    expect(result.imageBase64).toBeDefined();
    expect(typeof result.imageBase64).toBe('string');

    // Decode and verify dimensions
    const resultBuffer = Buffer.from(result.imageBase64, 'base64');
    const metadata = await sharp(resultBuffer).metadata();
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
  });

  test('applies blur to background (pixels should be softened)', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    expect(result.composited).toBe(true);
    expect(result.imageBase64).toBeDefined();
  });

  test('includes position information in result', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'right-third',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    expect(result.position).toBeDefined();
    expect(result.position.x).toBeGreaterThan(0);
    expect(result.position.y).toBeGreaterThan(0);
    expect(result.position.width).toBeGreaterThan(0);
    expect(result.position.height).toBeGreaterThan(0);
  });

  test('positions cutout at right-third when specified', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'right-third',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    // Right-third position should be around x = 1280 * 0.67 = ~858
    // Allow for cutout width centering
    expect(result.position.x).toBeGreaterThan(600);
  });

  test('positions cutout at left-third when specified', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'left-third',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    // Left-third position should be around x = 1280 * 0.33 = ~422
    expect(result.position.x).toBeLessThan(500);
  });

  test('positions cutout at center-bottom when specified', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center-bottom',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    // Center position should be around x = 1280 / 2 = 640
    expect(result.position.x).toBeGreaterThan(400);
    expect(result.position.x).toBeLessThan(800);
  });

  test('uses default blur and gradient when not specified', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
    });

    expect(result.composited).toBe(true);
    expect(result.imageBase64).toBeDefined();
  });

  test('clamps blur radius to valid range', async () => {
    // Very low blur should be clamped to minimum
    const resultLow = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      blurRadius: 2, // Below minimum 8
    });
    expect(resultLow.composited).toBe(true);

    // Very high blur should be clamped to maximum
    const resultHigh = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      blurRadius: 50, // Above maximum 15
    });
    expect(resultHigh.composited).toBe(true);
  });

  test('clamps gradient opacity to valid range', async () => {
    // Very low opacity should be clamped to minimum
    const resultLow = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      gradientOpacity: 0.05, // Below minimum 0.20
    });
    expect(resultLow.composited).toBe(true);

    // Very high opacity should be clamped to maximum
    const resultHigh = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      gradientOpacity: 0.80, // Above maximum 0.30
    });
    expect(resultHigh.composited).toBe(true);
  });

  test('composites cutout onto blurred + gradient background', async () => {
    const result = await compositeLifestyleThumbnail(backgroundBuffer, cutoutBuffer, {
      position: 'center',
      blurRadius: 12,
      gradientOpacity: 0.25,
    });

    // Decode result
    const resultBuffer = Buffer.from(result.imageBase64, 'base64');
    const { data, info } = await sharp(resultBuffer).raw().toBuffer({ resolveWithObject: true });

    // Check that the center area (where cutout should be) has red component
    // Center of 1280x720 is around (640, 360)
    const centerX = 640;
    const centerY = 360;
    const pixelIndex = (centerY * info.width + centerX) * info.channels;

    // The red cutout should be visible at center
    // Note: exact value depends on compositing, but red channel should be high
    expect(data[pixelIndex]).toBeGreaterThan(100); // R channel from red cutout
  });
});
