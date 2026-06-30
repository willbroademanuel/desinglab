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

// ===== Text Layer =====

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontSize: number;     // absolute px
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  isBold: boolean;
  isItalic: boolean;
  textAlign: TextAlign;
  letterSpacing: number;  // px, 0 = normal
  lineHeight: number;     // multiplier, 1.2 = normal
  width?: number;         // explicitly defined width for smart wrapping
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

// ===== Group Layer =====

export interface GroupLayer extends BaseLayer {
  type: 'group';
  layers: Layer[];
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

export function createTextLayer(id: string, canvasW: number, canvasH: number): TextLayer {
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
    color: '#000000',
    strokeColor: '#FFFFFF',
    strokeWidth: 0,
    isBold: true,
    isItalic: false,
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 1.2,
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
