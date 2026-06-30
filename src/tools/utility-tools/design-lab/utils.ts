// ==============================================================================
// DESIGNLAB — Utility Functions
// Device detection, font loading, ID generation, alignment helpers
// ==============================================================================

import type { DeviceCapability, Layer, AlignGuide, LayerFilters, HitBox } from './types';
import {
  SYSTEM_FONTS, MAX_CANVAS_DIM_DESKTOP, MAX_CANVAS_DIM_MOBILE,
  SNAP_THRESHOLD, FONT_LOAD_TIMEOUT_MS, FONT_REQUEST_DEBOUNCE_MS,
} from './constants';

// ===== Device Detection =====

let _cachedCapability: DeviceCapability | null = null;

export function getDeviceCapability(): DeviceCapability {
  if (_cachedCapability) return _cachedCapability;

  if (typeof window === 'undefined') {
    return { isMobile: false, isDesktop: true, maxCanvasDim: MAX_CANVAS_DIM_DESKTOP, hasTouch: false, tier: 'high', canUseWASM: true, shouldWarnOnHeavyTask: false };
  }

  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobile = width < 768;
  const isDesktop = !isMobile;

  // Detect actual canvas limit — some mobile browsers crash above 4096
  let maxCanvasDim = MAX_CANVAS_DIM_DESKTOP;
  if (isMobile) {
    maxCanvasDim = MAX_CANVAS_DIM_MOBILE;
    // iOS Safari specific: test canvas creation
    try {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 4096;
      testCanvas.height = 4096;
      const ctx = testCanvas.getContext('2d');
      if (!ctx) {
        maxCanvasDim = 2048;
      }
    } catch {
      maxCanvasDim = 2048;
    }
  }

  // Tier Detection
  const memory = (navigator as any).deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;

  let tier: 'low' | 'medium' | 'high' = 'high';
  if (memory < 2 || cores < 2) {
    tier = 'low';
  } else if (memory < 4 || cores < 4) {
    tier = 'medium';
  }

  const canUseWASM = tier !== 'low';
  const shouldWarnOnHeavyTask = tier === 'medium';

  _cachedCapability = { isMobile, isDesktop, maxCanvasDim, hasTouch, tier, canUseWASM, shouldWarnOnHeavyTask };
  return _cachedCapability;
}

// Reset cache on resize (orientation change)
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { _cachedCapability = null; }, { passive: true });
}

// ===== Unique ID Generator =====

let _idCounter = 0;

export function generateLayerId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

// ===== Font Security Sanitizer =====

/**
 * Sanitizes a font family name before injecting it into a Google Fonts URL.
 * Allows only characters that are valid in font family names:
 * letters, numbers, spaces, hyphens, and underscores.
 * This prevents CSS/URL injection attacks if fontFamily comes from user data.
 */
export function sanitizeFontName(name: string): string {
  // Remove any character that is NOT alphanumeric, space, hyphen, or underscore
  return name.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().substring(0, 100);
}

// ===== Async Google Fonts Loader (Enterprise Edition) =====
//
// Design:
//   1. Promise-cached — two simultaneous requests for the same font share one Promise.
//   2. Uses document.fonts.load() — the ONLY reliable API to know a font is
//      rasterised and usable by canvas (vs. just a CSS rule being inserted).
//   3. 5-second timeout — handles corporate firewalls, China CDN blocks, offline.
//   4. Debounced batch requests — rapid UI changes (e.g. scrubbing font list)
//      don't flood the CDN.
//   5. Failed fonts are marked attempted — prevents retry-storms on slow connections.

/** Cache: "FontName:weight" → resolved Promise (font is loaded) */
const _loadedFontKeys = new Set<string>();

/** Cache: "FontName:weight" → in-flight Promise */
const _fontPromises = new Map<string, Promise<void>>();

/** Debounce timers: "FontName:weight" → NodeJS.Timeout id */
const _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Asynchronously loads a Google Font at a specific weight.
 * Returns a Promise that resolves when the font is ready to use on Canvas.
 * Safe to call multiple times — subsequent calls for the same key are no-ops.
 *
 * @param fontName  Exact Google Fonts family name (e.g. "Playfair Display")
 * @param weight    Numeric font weight (default: 400)
 * @param debounce  If true, debounces the network request by FONT_REQUEST_DEBOUNCE_MS.
 *                  Use true for interactive font-picker hover, false for layer rendering.
 */
export async function loadGoogleFontAsync(
  fontName: string,
  weight: number = 400,
  debounce = false,
): Promise<void> {
  if (!fontName) return;
  if (SYSTEM_FONTS.has(fontName)) return; // System fonts need no loading

  const safeName = sanitizeFontName(fontName);
  if (!safeName) return;

  const key = `${safeName}:${weight}`;

  if (_loadedFontKeys.has(key)) return;  // Already loaded
  if (_fontPromises.has(key)) return _fontPromises.get(key)!; // Already in-flight

  if (typeof document === 'undefined') return; // SSR guard

  if (debounce) {
    // Clear any existing debounce timer for this key
    const existing = _debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    return new Promise<void>((resolve) => {
      _debounceTimers.set(
        key,
        setTimeout(() => {
          _debounceTimers.delete(key);
          loadGoogleFontAsync(safeName, weight, false).then(resolve).catch(resolve);
        }, FONT_REQUEST_DEBOUNCE_MS)
      );
    });
  }

  const promise = (async () => {
    try {
      // 1. Inject a <link> stylesheet for the specific font + weight
      //    Use <link> (not @import) for parallel loading and better caching.
      const encodedName = safeName.replace(/\s+/g, '+');
      const href = `https://fonts.googleapis.com/css2?family=${encodedName}:wght@${weight}&display=swap`;

      // Don't inject duplicate link tags
      if (!document.querySelector(`link[data-dl-font="${key}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-dl-font', key);
        document.head.appendChild(link);
      }

      // 2. Wait for the browser's font engine to confirm it's rasterised
      //    Race against a timeout to prevent hanging on network issues.
      await Promise.race([
        document.fonts.load(`${weight} 16px "${safeName}"`),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`[DesignLab] Font timeout: "${key}"`)),
            FONT_LOAD_TIMEOUT_MS
          )
        ),
      ]);

      _loadedFontKeys.add(key);
    } catch (err) {
      // Non-fatal: log the warning but mark as attempted.
      // This prevents retry storms on slow/offline connections.
      console.warn(`[DesignLab] Font load failed for "${key}":`, err);
      _loadedFontKeys.add(key); // Prevents infinite retries
    } finally {
      _fontPromises.delete(key);
    }
  })();

  _fontPromises.set(key, promise);
  return promise;
}

/**
 * Synchronous fire-and-forget shim — kept for backward compatibility with
 * existing call sites that don't await font loading.
 * New code should prefer `loadGoogleFontAsync`.
 */
export function loadGoogleFont(fontName: string, weight = 400): void {
  loadGoogleFontAsync(fontName, weight).catch(() => {});
}

/**
 * Checks if a specific font+weight combination is already fully loaded and
 * available for canvas rendering. Used by the renderer to decide whether to
 * use the real font or fall back to the system font stack.
 */
export function isFontReady(fontName: string, weight: number = 400): boolean {
  if (SYSTEM_FONTS.has(fontName)) return true;
  const safeName = sanitizeFontName(fontName);
  return _loadedFontKeys.has(`${safeName}:${weight}`);
}

/**
 * Batch pre-load a list of fonts. Used at app startup to pre-load featured fonts.
 */
export async function preloadFonts(
  families: { name: string; weight?: number }[]
): Promise<void> {
  await Promise.allSettled(
    families.map(({ name, weight = 400 }) => loadGoogleFontAsync(name, weight))
  );
}

// ===== Cross-Browser Text Rendering =====

/**
 * Draws text with explicit per-character letter-spacing, compatible with ALL
 * browsers including Safari ≤ 16 which does not support ctx.letterSpacing.
 *
 * Falls back to the native API when letterSpacing is 0 for maximum performance.
 *
 * @param ctx           Canvas 2D context
 * @param text          String to draw
 * @param x             Starting X coordinate (respects textAlign)
 * @param y             Y coordinate (baseline)
 * @param letterSpacing Additional spacing between each character in px
 * @param isStroke      If true, uses strokeText instead of fillText
 */
export function drawTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  isStroke = false,
): void {
  if (!text) return;

  if (letterSpacing === 0) {
    // Fast path — use native rendering
    isStroke ? ctx.strokeText(text, x, y) : ctx.fillText(text, x, y);
    return;
  }

  // Manual glyph-stepping for cross-browser letter spacing.
  // Note: textAlign must be 'left' before calling this since we position each glyph manually.
  let cx = x;
  for (const char of text) {
    isStroke ? ctx.strokeText(char, cx, y) : ctx.fillText(char, cx, y);
    cx += ctx.measureText(char).width + letterSpacing;
  }
}

/**
 * Measures the total width of a string with custom letter spacing.
 * Used to compute text bounding boxes before rendering.
 */
export function measureTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (!text) return 0;
  if (letterSpacing === 0) return ctx.measureText(text).width;

  let total = 0;
  for (const char of text) {
    total += ctx.measureText(char).width + letterSpacing;
  }
  // Subtract trailing spacing added after last character
  return Math.max(0, total - letterSpacing);
}

// ===== Curve Text Path Calculator =====

export interface GlyphPosition {
  char: string;
  x: number;
  y: number;
  rotation: number; // radians
}

/**
 * Calculates per-glyph {x, y, rotation} positions for text rendered along an
 * arc (circular curve). This is the mathematical heart of "curved text".
 *
 * Algorithm:
 *   1. Measure total text width (with letterSpacing).
 *   2. Derive arc radius from: r = totalWidth / |curveAngle_radians|.
 *   3. Walk each character along the arc, computing its midpoint angle.
 *   4. Return an array of glyph positions relative to the layer's center (0, 0).
 *      The caller applies ctx.save() / ctx.translate(layer.x, layer.y) before drawing.
 *
 * @param ctx           Canvas context (used for measureText)
 * @param text          The full text string (single line for curve)
 * @param curveAmount   Degrees: positive = arc up (convex top), negative = arc down (concave)
 * @param letterSpacing Additional px between characters
 * @returns Array of glyph positions, or empty array if curveAmount is 0
 */
export function calculateCurvePositions(
  ctx: CanvasRenderingContext2D,
  text: string,
  curveAmount: number,
  letterSpacing: number,
): GlyphPosition[] {
  if (curveAmount === 0 || !text) return [];

  // Safety clamp: prevent division by near-zero
  const clampedCurve = Math.max(-360, Math.min(360, curveAmount));
  const angleRad = (clampedCurve * Math.PI) / 180;

  // Measure total text width to compute radius
  const totalWidth = measureTextWithSpacing(ctx, text, letterSpacing);
  if (totalWidth <= 0) return [];

  // r = arc_length / angle_in_radians (arc length = totalWidth for our arc)
  const rawRadius = totalWidth / Math.abs(angleRad);
  // Minimum radius of 10px to prevent degenerate tiny arcs
  const radius = Math.max(rawRadius, 10);

  // For positive curve (arc up), text sits above center; radius points downward.
  // For negative curve (arc down), text sits below center; radius points upward.
  const sign = curveAmount > 0 ? 1 : -1;

  // Start angle: position so the arc is centered horizontally around the layer
  // startAngle is at the left edge of the text on the arc
  const startAngle = -Math.PI / 2 - angleRad / 2;

  const positions: GlyphPosition[] = [];
  let currentAngle = startAngle;

  // Center of the arc's circle, relative to layer origin
  // For a convex-top arc: circle center is BELOW the text
  const circleCy = sign * radius;

  for (const char of text) {
    const charWidth = ctx.measureText(char).width + letterSpacing;
    const charAngleSpan = charWidth / radius; // angle subtended by this character
    const midAngle = currentAngle + charAngleSpan / 2;

    // Glyph center position on the arc
    const glyphX = Math.cos(midAngle) * radius;
    const glyphY = circleCy + Math.sin(midAngle) * radius * sign;

    // Rotation: tangent to the arc at midAngle
    const glyphRotation = midAngle + (curveAmount > 0 ? Math.PI / 2 : -Math.PI / 2);

    positions.push({ char, x: glyphX, y: glyphY, rotation: glyphRotation });
    currentAngle += charAngleSpan;
  }

  return positions;
}

// ===== Canvas Filter String Builder =====

export function buildFilterString(
  filters: LayerFilters | null,
  universalBlur: number = 0,
  shadow: { x: number; y: number; blur: number; color: string } | null = null
): string {
  const parts: string[] = [];
  if (filters) {
    if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
    if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
    if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
    if (filters.hueRotate !== 0) parts.push(`hue-rotate(${filters.hueRotate}deg)`);
  }
  const totalBlur = (filters?.blur || 0) + universalBlur;
  if (totalBlur > 0) parts.push(`blur(${totalBlur}px)`);
  if (shadow && shadow.color !== 'transparent') {
    parts.push(`drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

// ===== Smart Alignment Guides =====

export function calculateAlignGuides(
  draggedId: string,
  dragX: number,
  dragY: number,
  hitBoxes: Record<string, HitBox>,
  canvasW: number,
  canvasH: number,
  layers: Layer[]
): { guides: AlignGuide[]; snapX: number; snapY: number } {
  const guides: AlignGuide[] = [];
  let snapX = dragX;
  let snapY = dragY;

  const dragBox = hitBoxes[draggedId];
  if (!dragBox) return { guides, snapX, snapY };

  const dCX = dragX;
  const dCY = dragY;
  const dLeft   = dragX - dragBox.w / 2;
  const dRight  = dragX + dragBox.w / 2;
  const dTop    = dragY - dragBox.h / 2;
  const dBottom = dragY + dragBox.h / 2;

  const targets: { label: string; cx: number; cy: number; left: number; right: number; top: number; bottom: number }[] = [
    {
      label: 'canvas',
      cx: canvasW / 2, cy: canvasH / 2,
      left: 0, right: canvasW,
      top: 0, bottom: canvasH,
    },
  ];

  for (const layer of layers) {
    if (layer.id === draggedId || !layer.visible) continue;
    const box = hitBoxes[layer.id];
    if (!box) continue;
    targets.push({
      label: layer.id,
      cx: layer.x, cy: layer.y,
      left:   layer.x - box.w / 2,
      right:  layer.x + box.w / 2,
      top:    layer.y - box.h / 2,
      bottom: layer.y + box.h / 2,
    });
  }

  for (const t of targets) {
    if (Math.abs(dCX - t.cx) < SNAP_THRESHOLD) {
      snapX = t.cx;
      guides.push({ orientation: 'vertical', position: t.cx });
    }
    if (Math.abs(dCY - t.cy) < SNAP_THRESHOLD) {
      snapY = t.cy;
      guides.push({ orientation: 'horizontal', position: t.cy });
    }
    if (Math.abs(dLeft - t.left) < SNAP_THRESHOLD) {
      snapX = t.left + dragBox.w / 2;
      guides.push({ orientation: 'vertical', position: t.left });
    }
    if (Math.abs(dRight - t.right) < SNAP_THRESHOLD) {
      snapX = t.right - dragBox.w / 2;
      guides.push({ orientation: 'vertical', position: t.right });
    }
    if (Math.abs(dTop - t.top) < SNAP_THRESHOLD) {
      snapY = t.top + dragBox.h / 2;
      guides.push({ orientation: 'horizontal', position: t.top });
    }
    if (Math.abs(dBottom - t.bottom) < SNAP_THRESHOLD) {
      snapY = t.bottom - dragBox.h / 2;
      guides.push({ orientation: 'horizontal', position: t.bottom });
    }
  }

  return { guides, snapX, snapY };
}

// ===== Clamp Utility =====

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Safe numeric parse — returns fallback if result is not a finite number. */
export function safeNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return isFinite(n) ? n : fallback;
}

// ===== Constrain canvas dimensions to device limit =====

export function constrainDimensions(w: number, h: number): { width: number; height: number } {
  const { maxCanvasDim } = getDeviceCapability();
  if (w <= maxCanvasDim && h <= maxCanvasDim) return { width: w, height: h };
  const ratio = Math.min(maxCanvasDim / w, maxCanvasDim / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

// ===== Resize Image File if Needed =====

export async function resizeImageFileIfNeeded(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = constrainDimensions(img.width, img.height);
      
      if (width === img.width && height === img.height) {
        resolve(file);
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const resizedFile = new File([blob], file.name, {
          type: file.type || 'image/png',
          lastModified: Date.now(),
        });
        resolve(resizedFile);
      }, file.type || 'image/png', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback on error
    };
    img.src = url;
  });
}
