/**
 * Imagen 4 API Types
 * Shared type definitions for the thumbnail generation API
 */

// ============================================================================
// Imagen 4 Model Configuration
// ============================================================================

export const IMAGEN_MODELS = {
  STANDARD: 'imagen-4.0-generate-001',
  FAST: 'imagen-4.0-fast-generate-001',
  ULTRA: 'imagen-4.0-ultra-generate-001',
} as const;

export type ImagenModelTier = keyof typeof IMAGEN_MODELS;

export const IMAGEN_CONFIG = {
  maxImages: 4,
  supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'] as const,
  resolutions: {
    standard: ['1024x1024', '896x1280', '1280x896', '768x1408', '1408x768'],
    highRes: ['2048x2048', '1792x2560', '2560x1792', '1536x2816', '2816x1536'],
  },
  quotas: {
    STANDARD: 75,  // requests per minute
    FAST: 150,
    ULTRA: 30,
  },
  personGeneration: ['dont_allow', 'allow_adult', 'allow_all'] as const,
} as const;

export type AspectRatio = typeof IMAGEN_CONFIG.supportedAspectRatios[number];
export type PersonGeneration = typeof IMAGEN_CONFIG.personGeneration[number];
export type ImageSize = '1K' | '2K';

// ============================================================================
// Product Analysis Types
// ============================================================================

export interface LightingAnalysis {
  angle: 'top-left' | 'top-right' | 'front' | 'back' | 'ambient';
  intensity: 'soft' | 'medium' | 'harsh';
  colorTemperature: 'warm' | 'neutral' | 'cool';
}

export interface ColorAnalysis {
  dominant: string;
  secondary: string;
  accent: string;
  palette: string[];
}

export interface MaterialAnalysis {
  surface: 'matte' | 'glossy' | 'metallic' | 'textured' | 'mixed';
  reflectivity: number; // 0-1
}

export interface ShapeAnalysis {
  category: 'bottle' | 'box' | 'tube' | 'irregular' | 'cylindrical';
  hasText: boolean;
}

export interface Recommendations {
  suggestedBackgrounds: string[];
  avoidColors: string[];
  pedestalStyle: 'none' | 'simple' | 'reflective' | 'floating';
}

export interface AnalyzeProductResponse {
  lighting: LightingAnalysis;
  colors: ColorAnalysis;
  material: MaterialAnalysis;
  shape: ShapeAnalysis;
  recommendations: Recommendations;
}

// ============================================================================
// Thumbnail Generation Types
// ============================================================================

export interface GeneratedImage {
  imageBase64: string;
  qualityScore: number;
  mimeType: string;
  /** Indicates if the product cutout was composited onto the background */
  composited?: boolean;
}

export interface GenerateThumbnailResponse {
  id: string;
  variations: GeneratedImage[];
  analysis: AnalyzeProductResponse;
  modelUsed: string;
}

export interface GenerateThumbnailOptions {
  variations?: 1 | 2 | 3 | 4;
  aspectRatio?: AspectRatio;
  modelTier?: ImagenModelTier;
  imageSize?: ImageSize;
  personGeneration?: PersonGeneration;
}

// ============================================================================
// Infographic Types
// ============================================================================

export interface ProductInfoGraphic {
  headline: string;           // Main selling point (e.g., "20 Servings")
  subheadline?: string;       // Secondary text (e.g., "Pre-Workout Formula")
  bulletPoints: string[];     // Key benefits (e.g., ["150mg Caffeine", "Zero Sugar", "Enhanced Focus"])
  category: string;           // Product category for background style
}

export interface ExtractedProductInfo {
  productName: string;
  category: string;
  keyBenefits: string[];
  specs: string[];
  suggestedHeadline: string;
  suggestedSubheadline: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AnalyzeProductRequest {
  cutoutBase64: string;
  productDescription?: string;
  scriptContent?: string;      // NEW: Script text to extract product info from
}

export interface GenerateThumbnailRequest {
  cutoutBase64: string;
  analysis: AnalyzeProductResponse;
  industryPrompt: string;
  variations?: 1 | 2 | 3 | 4;
  aspectRatio?: AspectRatio;
  modelTier?: ImagenModelTier;
  imageSize?: ImageSize;
  // NEW: Infographic options
  infographic?: ProductInfoGraphic;
  includeInfographic?: boolean;
}

// ============================================================================
// Scene Design Types (for Contextual Lifestyle Thumbnails)
// ============================================================================

export type EnvironmentType =
  | 'gym'
  | 'kitchen'
  | 'studio'
  | 'office'
  | 'outdoor'
  | 'home'
  | 'spa'
  | 'garage'
  | 'bathroom'
  | 'bedroom';

export interface SceneLighting {
  type: 'dramatic' | 'soft' | 'natural' | 'studio' | 'golden-hour' | 'neon';
  direction: 'side' | 'front' | 'back' | 'overhead' | 'ambient';
  intensity: 'high-contrast' | 'balanced' | 'low-key';
}

export interface SceneEnvironment {
  type: EnvironmentType;
  description: string;
  props: string[];
  lighting: SceneLighting;
}

export type ColorMood = 'energetic' | 'premium' | 'calm' | 'natural' | 'bold' | 'elegant' | 'playful';

export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  textColor: string;
  mood: ColorMood;
}

export type PedestalStyle =
  | 'black-glossy'
  | 'white-matte'
  | 'glass'
  | 'wooden'
  | 'metal'
  | 'floating'
  | 'marble'
  | 'concrete'
  | 'none';

export type PedestalShape = 'circular' | 'rectangular' | 'hexagonal' | 'organic' | 'platform';
export type PedestalPosition = 'center' | 'right-third' | 'left-third' | 'center-bottom';

export interface PedestalDesign {
  style: PedestalStyle;
  shape: PedestalShape;
  position: PedestalPosition;
  hasReflection: boolean;
  productSpaceRatio: number;
}

export type IconPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-side'
  | 'right-side'
  | 'around-product';

export type IconStyle = 'filled' | 'outline' | 'glow' | 'circle-badge';

export interface IconCallout {
  iconDescription: string;
  label: string;
  position: IconPosition;
  style: IconStyle;
}

export type HeadlineStyle = 'bold-sans' | 'impact' | 'elegant-serif' | 'modern-thin' | 'brush';
export type HeadlinePosition = 'top-center' | 'top-left' | 'bottom-center' | 'top-right';
export type HeadlineSize = 'large' | 'xlarge' | 'medium';

export interface HeadlineSpec {
  text: string;
  position: HeadlinePosition;
  style: HeadlineStyle;
  size: HeadlineSize;
}

export interface SubheadlineSpec {
  text: string;
  position: 'below-headline' | 'bottom-center' | 'above-headline';
  style: 'regular' | 'light' | 'italic';
}

export interface TextLayout {
  headline: HeadlineSpec;
  subheadline?: SubheadlineSpec;
  iconCallouts: IconCallout[];
}

export type ProductAspectRatio = 'tall' | 'wide' | 'square' | 'cylindrical';
export type ProductSurfaceType = 'matte' | 'glossy' | 'metallic' | 'textured' | 'transparent';

export interface ProductCharacteristics {
  shapeDescription: string;
  aspectRatio: ProductAspectRatio;
  dominantColors: string[];
  surfaceType: ProductSurfaceType;
}

export interface SceneDesign {
  id: string;
  environment: SceneEnvironment;
  colorScheme: ColorScheme;
  pedestal: PedestalDesign;
  textLayout: TextLayout;
  productCharacteristics: ProductCharacteristics;
  generatedPrompt?: string;
  createdAt: number;
}

export interface GenerateContextualThumbnailRequest {
  /** Product cutout as base64 */
  cutoutBase64: string;
  /** Pre-computed scene design from frontend */
  sceneDesign: SceneDesign;
  /** Pre-constructed Imagen prompt */
  imagenPrompt: string;
  /** Number of variations (1-4) */
  variations?: 1 | 2 | 3 | 4;
  /** Aspect ratio */
  aspectRatio?: AspectRatio;
  /** Model tier */
  modelTier?: ImagenModelTier;
  /** Image size */
  imageSize?: ImageSize;
}

export interface ContextualThumbnailResponse {
  id: string;
  variations: GeneratedImage[];
  sceneDesign: SceneDesign;
  modelUsed: string;
}

// ============================================================================
// Express Extensions
// ============================================================================

export interface AuthenticatedRequest {
  userId?: string;
  userEmail?: string;
}
