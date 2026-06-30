// ==============================================================================
// DESIGNLAB — Enterprise Photo Editor
// Type definitions for the entire editor
// ==============================================================================

// ===== Enums & Unions =====

export type LayerType = 'text' | 'image' | 'shape' | 'drawing' | 'group';

export type ShapeKind =
  | 'rectangle' | 'circle' | 'triangle' | 'star'
  | 'line' | 'arrow' | 'heart' | 'hexagon';

export type TextAlign = 'left' | 'center' | 'right';
export type BgType = 'solid' | 'gradient' | 'image' | 'transparent';
export type ToolMode = 'select' | 'text' | 'shape' | 'pan';
export type ExportFormat = 'png' | 'jpg' | 'webp';
export type SidebarTab = 'elements' | 'text' | 'images' | 'background' | 'layers' | 'assets' | 'edit';

// ===== Text Typography Types =====

/** Text fill mode — solid colour, linear gradient, or full-spectrum rainbow */
export type TextFillType = 'solid' | 'gradient' | 'rainbow';

/**
 * Curve path shape.
 * 'arc'   — single circular arc (shipped in this release)
 * 'wave'  — sine-wave path (stubbed for future release)
 * 'arch'  — parabolic arch (stubbed for future release)
 */
export type TextCurveType = 'arc' | 'wave' | 'arch';

/** CSS text-transform equivalent */
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

/** Text decoration (manually drawn on canvas) */
export type TextDecoration = 'none' | 'underline' | 'line-through';

/**
 * CSS numeric font-weight values.
 * Note: not all weights are available for every Google Font.
 * Check FONT_LIST[x].weights for a font's supported weights.
 */
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

// ===== Text Sub-structures =====

/** Text highlight / background box rendered behind text */
export interface TextBackgroundBox {
  enabled: boolean;
  color: string;        // CSS color, supports rgba. Default 'rgba(0,0,0,0.5)'
  padding: number;      // Extra padding around each line's bounding box (px). Default 8
  cornerRadius: number; // Rounded corners radius. Default 4
}

/** Neon glow effect rendered via multi-pass shadowBlur */
export interface TextNeonGlow {
  enabled: boolean;
  color: string;     // Glow colour. Default '#00ffff'
  intensity: number; // Controls shadowBlur spread (0–30). Default 8
}

export const DEFAULT_TEXT_BACKGROUND_BOX: TextBackgroundBox = {
  enabled: false,
  color: 'rgba(0,0,0,0.5)',
  padding: 8,
  cornerRadius: 4,
};

export const DEFAULT_TEXT_NEON_GLOW: TextNeonGlow = {
  enabled: false,
  color: '#00ffff',
  intensity: 8,
};

// ===== Layer Filters (per-layer image adjustments) =====

export interface LayerFilters {
  brightness: number;   // 0–200, default 100
  contrast: number;     // 0–200, default 100
  saturation: number;   // 0–200, default 100
  hueRotate: number;    // 0–360, default 0
  blur: number;         // 0–20px, default 0
}

export const DEFAULT_FILTERS: LayerFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  blur: 0,
};

// ===== Base Layer =====

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  x: number;            // center X in canvas pixels
  y: number;            // center Y in canvas pixels
  rotation: number;     // degrees
  opacity: number;      // 0–1
  locked: boolean;
  visible: boolean;
  flipH: boolean;
  flipV: boolean;
  isMask?: boolean;     // if true, acts as a clipping mask for siblings above it
  blur?: number;        // Universal blur for all objects
  shadow?: { x: number; y: number; blur: number; color: string } | null; // Universal drop shadow
}

// ===== Group Layer =====

export interface GroupLayer extends BaseLayer {
  type: 'group';
  layers: Layer[];      // Nested child layers
  width: number;
  height: number;
}

// ===== Text Layer — Enterprise Edition =====

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontSize: number;         // absolute px
  fontFamily: string;

  // ── Core fill ──
  color: string;            // Solid fill colour (used when fillType === 'solid')
  strokeColor: string;
  strokeWidth: number;

  // ── Typography ──
  /** isBold is kept for backward-compat. fontWeight takes precedence in the renderer.
   *  Migration: isBold=true → fontWeight=700. */
  isBold: boolean;
  isItalic: boolean;
  textAlign: TextAlign;
  letterSpacing: number;    // px, 0 = normal
  lineHeight: number;       // multiplier, 1.2 = normal
  width?: number;           // explicitly defined width for smart wrapping

  // ── NEW: Extended typography ──
  /** Numeric font weight (100–900). Default: 400 (regular). Replaces isBold semantics. */
  fontWeight: FontWeight;
  textTransform: TextTransform;    // Default: 'none'
  textDecoration: TextDecoration;  // Default: 'none'
  /** Internal text box padding (px). Default: 12. Replaces the hardcoded TEXT_PADDING constant. */
  padding: number;

  // ── NEW: Fill ──
  /** How to fill the text glyphs. Default: 'solid' (uses `color` field). */
  fillType: TextFillType;
  /** Gradient start/end colours. Used when fillType === 'gradient' or 'rainbow'. */
  gradientColors: [string, string];
  /** Gradient angle in degrees. Default: 135. */
  gradientAngle: number;

  // ── NEW: Effects ──
  /** Background highlight rectangle drawn behind the text. null = disabled. */
  backgroundBox: TextBackgroundBox | null;
  /** Neon glow effect. null = disabled. */
  neonGlow: TextNeonGlow | null;

  // ── NEW: Curve ──
  /**
   * Curve amount in degrees (-360 to 360).
   * 0 = straight (fast-path, no curve calculation).
   * Positive = arc curves upward (text on top of circle).
   * Negative = arc curves downward (text on bottom of circle).
   */
  curveAmount: number;
  /** Shape of the curve path. Default: 'arc'. */
  curveType: TextCurveType;
}

// ===== Image Layer =====

export interface ImageBorder {
  enabled: boolean;
  color: string;          // solid border color
  thickness: number;      // 0–40 px
  glowEnabled: boolean;
  glowColor: string;      // glow border color
  glowRadius: number;     // 0–60 px blur radius
}

export const DEFAULT_IMAGE_BORDER: ImageBorder = {
  enabled: false,
  color: '#FFFFFF',
  thickness: 4,
  glowEnabled: false,
  glowColor: '#3b82f6',
  glowRadius: 15,
};

export interface ImageLayer extends BaseLayer {
  type: 'image';
  file: File;
  scale: number;        // multiplier on original image size
  filters: LayerFilters;
  border: ImageBorder;
}

// ===== Shape Layer =====

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeKind: ShapeKind;
  width: number;
  height: number;
  fill: string;
  fillType: 'solid' | 'gradient' | 'none';
  gradientColors: [string, string];
  gradientAngle: number;
  gradientStop?: number;  // 0 to 100, default 50
  stroke: string;
  strokeWidth: number;
  strokeDash: number[];   // e.g. [5, 5] for dashed
  cornerRadius: number;   // for rectangle
  starPoints: number;     // for star shape
  starInnerRadius: number; // 0–1, for star
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | GroupLayer;

// ===== Project / Workspace =====

export interface Project {
  canvasWidth: number;
  canvasHeight: number;
  bgType: BgType;
  bgColor: string;
  bgGradient: { c1: string; c2: string; angle: number };
  bgImageFile: File | null;
  sliceX: number; // For slicing features like IG carousels
  sliceY: number; // For slicing features
  layers: Layer[];
}

// ===== Canvas Preset =====

export interface CanvasPreset {
  name: string;
  width: number;
  height: number;
  category: 'social' | 'print' | 'video' | 'custom';
}

// ===== Export Options =====

export interface ExportOptions {
  format: ExportFormat;
  quality: number;   // 0.1–1.0
  scale: number;     // 1, 2, 3
}

// ===== Hit Box (for click detection) =====

export interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ===== Smart Alignment Guide =====

export interface AlignGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
}

// ===== Device Capability =====

export type DeviceTier = 'low' | 'medium' | 'high';

export interface DeviceCapability {
  isMobile: boolean;
  isDesktop: boolean;
  maxCanvasDim: number;
  hasTouch: boolean;
  tier: DeviceTier;
  canUseWASM: boolean;
  shouldWarnOnHeavyTask: boolean;
}

// ===== Factory Functions =====

export function createEmptyProject(w = 1080, h = 1080): Project {
  return {
    canvasWidth: w,
    canvasHeight: h,
    bgType: 'solid',
    bgColor: '#FFFFFF',
    bgGradient: { c1: '#FF512F', c2: '#DD2476', angle: 135 },
    bgImageFile: null,
    sliceX: 1,
    sliceY: 1,
    layers: [],
  };
}

/**
 * Creates a new TextLayer with all enterprise defaults.
 * All new fields are explicitly set so the canvas never encounters undefined.
 */
export function createTextLayer(
  id: string,
  canvasW: number,
  canvasH: number,
  overrides: Partial<Omit<TextLayer, 'id' | 'type'>> = {}
): TextLayer {
  return {
    id,
    type: 'text',
    name: 'Text',
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    flipH: false,
    flipV: false,
    blur: 0,
    shadow: null,
    text: 'Double click to edit',
    fontSize: Math.round(canvasH * 0.06),
    fontFamily: 'Inter',
    // Core fill
    color: '#000000',
    strokeColor: '#FFFFFF',
    strokeWidth: 0,
    // Typography
    isBold: false,
    isItalic: false,
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 1.2,
    // Extended typography
    fontWeight: 700,
    textTransform: 'none',
    textDecoration: 'none',
    padding: 12,
    // Fill
    fillType: 'solid',
    gradientColors: ['#FF512F', '#DD2476'],
    gradientAngle: 135,
    // Effects
    backgroundBox: null,
    neonGlow: null,
    // Curve
    curveAmount: 0,
    curveType: 'arc',
    // Apply caller overrides last
    ...overrides,
  };
}

export function createImageLayer(id: string, file: File, canvasW: number, canvasH: number): ImageLayer {
  return {
    id,
    type: 'image',
    name: file.name.split('.')[0] || 'Image',
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    flipH: false,
    flipV: false,
    blur: 0,
    shadow: null,
    file,
    scale: 0.5,
    filters: { ...DEFAULT_FILTERS },
    border: { ...DEFAULT_IMAGE_BORDER },
  };
}

export function createShapeLayer(
  id: string,
  kind: ShapeKind,
  canvasW: number,
  canvasH: number
): ShapeLayer {
  const size = Math.min(canvasW, canvasH) * 0.2;
  return {
    id,
    type: 'shape',
    name: kind.charAt(0).toUpperCase() + kind.slice(1),
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    flipH: false,
    flipV: false,
    blur: 0,
    shadow: null,
    shapeKind: kind,
    width: kind === 'line' || kind === 'arrow' ? size * 1.5 : size,
    height: kind === 'line' || kind === 'arrow' ? 8 : size,
    fill: '#3b82f6',
    fillType: 'solid',
    gradientColors: ['#FF512F', '#DD2476'],
    gradientAngle: 135,
    stroke: kind === 'line' || kind === 'arrow' ? '#3b82f6' : '#1d4ed8',
    strokeWidth: kind === 'line' || kind === 'arrow' ? 8 : 0,
    strokeDash: [],
    cornerRadius: kind === 'rectangle' ? 8 : 0,
    starPoints: 5,
    starInnerRadius: 0.4,
  };
}

export function createGroupLayer(id: string, layers: Layer[]): GroupLayer {
  return {
    id,
    type: 'group',
    name: 'Group',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    flipH: false,
    flipV: false,
    layers,
  };
}

// ===== Backward-Compatible Migration =====

/**
 * Ensures a TextLayer loaded from IndexedDB (saved before the enterprise update)
 * has all required new fields. Call this when loading any project from storage.
 * Returns the layer with all new fields populated from defaults — safe to call
 * even if the layer already has all fields (pure function, no mutation).
 */
export function migrateTextLayer(raw: Partial<TextLayer> & Pick<TextLayer, 'id' | 'type'>): TextLayer {
  const base = createTextLayer(raw.id, 1080, 1080); // defaults from factory
  return {
    ...base,
    ...raw,
    // Explicit migration: isBold=true → fontWeight=700 (if fontWeight not already set)
    fontWeight: raw.fontWeight ?? (raw.isBold ? 700 : 400),
    // Ensure all new fields have safe values even if raw has partial data
    textTransform: raw.textTransform ?? 'none',
    textDecoration: raw.textDecoration ?? 'none',
    padding: raw.padding ?? 12,
    fillType: raw.fillType ?? 'solid',
    gradientColors: raw.gradientColors ?? ['#FF512F', '#DD2476'],
    gradientAngle: raw.gradientAngle ?? 135,
    backgroundBox: raw.backgroundBox ?? null,
    neonGlow: raw.neonGlow ?? null,
    curveAmount: raw.curveAmount ?? 0,
    curveType: raw.curveType ?? 'arc',
  };
}
