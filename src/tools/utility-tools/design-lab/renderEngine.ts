// ==============================================================================
// DESIGNLAB — Canvas Rendering Engine (Enterprise Edition)
// Pure functions for drawing layers to a canvas context.
//
// Text rendering pipeline:
//   renderTextLayer
//     ├── buildFontString        — constructs CSS font declaration
//     ├── applyTextTransform     — applies textTransform to the raw string
//     ├── wrapText               — word-wraps text to bounding box
//     ├── renderStraightText     — standard multi-line renderer
//     │     ├── drawBackgroundBox    — highlight rectangle behind text
//     │     ├── applyNeonGlow        — multi-pass glow via shadowBlur
//     │     ├── buildTextGradient    — linear gradient fill
//     │     └── drawTextWithSpacing  — cross-browser glyph stepper
//     └── renderCurvedText       — arc-path single-line renderer
//           └── per-glyph save/rotate/draw loop
// ==============================================================================

import type {
  Project, Layer, TextLayer, ImageLayer, ShapeLayer,
  HitBox, AlignGuide,
} from './types';
import {
  buildFilterString,
  loadGoogleFont,
  loadGoogleFontAsync,
  isFontReady,
  drawTextWithSpacing,
  measureTextWithSpacing,
  calculateCurvePositions,
  clamp,
  safeNum,
} from './utils';

// ===== Glyph Position Cache =====
// Curve glyph positions are expensive to compute (measureText per char).
// Cache keyed on a hash of the properties that affect curve geometry.

const _curveCache = new Map<string, ReturnType<typeof calculateCurvePositions>>();

function getCurvePositions(
  ctx: CanvasRenderingContext2D,
  text: string,
  curveAmount: number,
  letterSpacing: number,
  cacheKey: string,
): ReturnType<typeof calculateCurvePositions> {
  if (_curveCache.has(cacheKey)) return _curveCache.get(cacheKey)!;
  const positions = calculateCurvePositions(ctx, text, curveAmount, letterSpacing);
  // Cap cache size to prevent unbounded memory growth
  if (_curveCache.size > 200) {
    const firstKey = _curveCache.keys().next().value;
    if (firstKey !== undefined) _curveCache.delete(firstKey);
  }
  _curveCache.set(cacheKey, positions);
  return positions;
}

/** Invalidate the curve cache entry for a layer (call after any text property change). */
export function invalidateCurveCache(layerId: string): void {
  for (const key of _curveCache.keys()) {
    if (key.startsWith(layerId)) _curveCache.delete(key);
  }
}

// ===== Main Render Function =====

export function renderProject(
  ctx: CanvasRenderingContext2D,
  project: Project,
  hitBoxes: Record<string, HitBox>,
  imageCache: Record<string, HTMLImageElement>,
  bgImageEl: HTMLImageElement | null,
  activeLayerIds: string[],
  editingId: string | null,
  guides: AlignGuide[],
  zoom: number,
  hoveredId: string | null = null,
  isExport: boolean = false,
  onFontLoaded?: () => void,
): void {
  const { canvasWidth: w, canvasHeight: h } = project;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);

  // ── Background ──
  renderBackground(ctx, project, bgImageEl, w, h, isExport);

  // ── Clear hit boxes ──
  for (const key in hitBoxes) delete hitBoxes[key];

  // ── Render Layer Tree Recursively ──
  function renderLayerTree(layers: Layer[]) {
    let maskApplied = false;

    for (const layer of layers) {
      if (!layer.visible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      switch (layer.type) {
        case 'text':
          renderTextLayer(ctx, layer, hitBoxes, editingId, onFontLoaded);
          break;
        case 'image':
          renderImageLayer(ctx, layer, hitBoxes, imageCache);
          break;
        case 'shape':
          renderShapeLayer(ctx, layer, hitBoxes);
          break;
        case 'group':
          ctx.translate(layer.x, layer.y);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          if (layer.flipH || layer.flipV) {
            ctx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
          }
          hitBoxes[layer.id] = {
            x: -layer.width / 2,
            y: -layer.height / 2,
            w: layer.width,
            h: layer.height,
          };
          renderLayerTree(layer.layers);
          break;
      }

      ctx.restore();

      if (layer.isMask && !maskApplied) {
        maskApplied = true;
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        const box = hitBoxes[layer.id];
        if (box) {
          ctx.beginPath();
          if (layer.type === 'shape' && layer.shapeKind === 'circle') {
            ctx.arc(0, 0, box.w / 2, 0, Math.PI * 2);
          } else if (layer.type === 'shape' && layer.shapeKind === 'rectangle') {
            const r = layer.cornerRadius || 0;
            ctx.roundRect(-box.w / 2, -box.h / 2, box.w, box.h, r);
          } else {
            ctx.rect(-box.w / 2, -box.h / 2, box.w, box.h);
          }
          ctx.clip();
        }
        ctx.rotate((-layer.rotation * Math.PI) / 180);
        ctx.translate(-layer.x, -layer.y);
      }
    }

    if (maskApplied) {
      ctx.restore();
    }
  }

  renderLayerTree(project.layers);

  // ── Smart alignment guides ──
  if (!isExport && guides.length > 0) {
    renderAlignGuides(ctx, guides, w, h);
  }

  // ── Slice grids (e.g. for IG Carousels) ──
  if (!isExport && (project.sliceX > 1 || project.sliceY > 1)) {
    renderSliceGuides(ctx, project.sliceX, project.sliceY, w, h, zoom);
  }
}

// ===== Background Renderer =====

function renderBackground(
  ctx: CanvasRenderingContext2D,
  project: Project,
  bgImageEl: HTMLImageElement | null,
  w: number,
  h: number,
  isExport: boolean = false
): void {
  switch (project.bgType) {
    case 'solid':
      ctx.fillStyle = project.bgColor;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'gradient': {
      const { c1, c2, angle } = project.bgGradient;
      const rad = ((angle - 90) * Math.PI) / 180;
      const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
      const half = len / 2;
      const cx = w / 2, cy = h / 2;
      const grad = ctx.createLinearGradient(
        cx - Math.cos(rad) * half, cy - Math.sin(rad) * half,
        cx + Math.cos(rad) * half, cy + Math.sin(rad) * half,
      );
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'image':
      if (bgImageEl) {
        ctx.drawImage(bgImageEl, 0, 0, w, h);
      }
      break;
    case 'transparent':
      if (!isExport) {
        drawCheckerboard(ctx, w, h);
      }
      break;
  }
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const size = 16;
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = size * 2;
  patternCanvas.height = size * 2;
  const pCtx = patternCanvas.getContext('2d');
  if (pCtx) {
    pCtx.fillStyle = '#FFFFFF';
    pCtx.fillRect(0, 0, size * 2, size * 2);
    pCtx.fillStyle = '#E0E0E0';
    pCtx.fillRect(0, 0, size, size);
    pCtx.fillRect(size, size, size, size);
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

// ===== Text Layer — Enterprise Renderer =====

/** Builds the CSS font declaration string from a TextLayer's properties. */
function buildFontString(layer: TextLayer): string {
  const style  = layer.isItalic ? 'italic' : 'normal';
  // fontWeight takes precedence over isBold for backward-compat migration
  const weight = safeNum(layer.fontWeight, layer.isBold ? 700 : 400);
  const size   = clamp(safeNum(layer.fontSize, 20), 1, 4096);
  const family = layer.fontFamily || 'sans-serif';
  return `${style} ${weight} ${size}px "${family}", sans-serif`;
}

/** Applies textTransform to a string, mirroring the CSS property behaviour. */
function applyTextTransform(text: string, transform: TextLayer['textTransform']): string {
  switch (transform) {
    case 'uppercase':  return text.toUpperCase();
    case 'lowercase':  return text.toLowerCase();
    case 'capitalize': return text.replace(/\b\w/g, c => c.toUpperCase());
    default:           return text;
  }
}

/**
 * Creates a linear gradient fill for text that spans the full bounding box.
 * The gradient is created in the layer's local coordinate space (after translate).
 */
function buildTextGradient(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  boxW: number,
  boxH: number,
): CanvasGradient {
  const angle     = safeNum(layer.gradientAngle, 135);
  const rad       = ((angle - 90) * Math.PI) / 180;
  const halfW     = boxW / 2;
  const halfH     = boxH / 2;
  const len       = Math.abs(boxW * Math.cos(rad)) + Math.abs(boxH * Math.sin(rad));
  const halfLen   = len / 2;
  const cx        = 0; // already in translated layer space
  const cy        = 0;
  const grad      = ctx.createLinearGradient(
    cx - Math.cos(rad) * halfLen, cy - Math.sin(rad) * halfLen,
    cx + Math.cos(rad) * halfLen, cy + Math.sin(rad) * halfLen,
  );

  if (layer.fillType === 'rainbow') {
    // Full spectrum rainbow
    grad.addColorStop(0,    '#ff0000');
    grad.addColorStop(0.17, '#ff8800');
    grad.addColorStop(0.33, '#ffff00');
    grad.addColorStop(0.5,  '#00ff00');
    grad.addColorStop(0.67, '#0088ff');
    grad.addColorStop(0.83, '#8800ff');
    grad.addColorStop(1,    '#ff0088');
  } else {
    const [c1, c2] = layer.gradientColors ?? ['#FF512F', '#DD2476'];
    grad.addColorStop(0, c1 || '#FF512F');
    grad.addColorStop(1, c2 || '#DD2476');
  }
  return grad;
}

/**
 * Draws a rounded background highlight rectangle behind a single line of text.
 *
 * @param ctx     Canvas context (already translated to layer center)
 * @param lineX   X center of the text line (per textAlign)
 * @param lineY   Y center of the text line
 * @param lineW   Width of the text line
 * @param lineH   Height of the line (fontSize * lineHeight)
 * @param box     BackgroundBox config from the layer
 */
function drawLineBackgroundBox(
  ctx: CanvasRenderingContext2D,
  lineX: number,
  lineY: number,
  lineW: number,
  lineH: number,
  textAlign: TextLayer['textAlign'],
  box: NonNullable<TextLayer['backgroundBox']>,
): void {
  const pad  = safeNum(box.padding, 8);
  const r    = clamp(safeNum(box.cornerRadius, 4), 0, 50);
  const bw   = lineW + pad * 2;
  const bh   = lineH + pad * 2;

  let bx: number;
  if (textAlign === 'left')       bx = lineX - pad;
  else if (textAlign === 'right') bx = lineX - lineW - pad;
  else                            bx = lineX - lineW / 2 - pad; // center

  const by = lineY - lineH / 2 - pad;

  ctx.save();
  ctx.fillStyle = box.color || 'rgba(0,0,0,0.5)';
  if (r > 0) {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, bw, bh);
  }
  ctx.restore();
}

/**
 * Applies neon glow to the context via multi-pass shadowBlur.
 * Must be called BEFORE the fillText/strokeText calls.
 * Call ctx.shadowBlur = 0 after to reset.
 */
function applyNeonGlow(
  ctx: CanvasRenderingContext2D,
  glow: NonNullable<TextLayer['neonGlow']>,
): void {
  const intensity = clamp(safeNum(glow.intensity, 8), 0, 30);
  ctx.shadowColor   = glow.color || '#00ffff';
  ctx.shadowBlur    = intensity * 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Draws a manual underline under a text line (canvas has no native text decoration). */
function drawTextDecoration(
  ctx: CanvasRenderingContext2D,
  line: string,
  textX: number,
  textY: number,
  lineW: number,
  fontSize: number,
  letterSpacing: number,
  decoration: TextLayer['textDecoration'],
  textAlign: TextLayer['textAlign'],
  color: string,
): void {
  if (decoration === 'none') return;

  const thickness = Math.max(1, fontSize * 0.05);
  const lineLen   = lineW;

  let x1: number;
  if (textAlign === 'left')       x1 = textX;
  else if (textAlign === 'right') x1 = textX - lineLen;
  else                            x1 = textX - lineLen / 2;

  const x2 = x1 + lineLen;
  let decY: number;

  if (decoration === 'underline') {
    decY = textY + fontSize * 0.15;
  } else { // line-through
    decY = textY;
  }

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth   = thickness;
  ctx.moveTo(x1, decY);
  ctx.lineTo(x2, decY);
  ctx.stroke();
  ctx.restore();
}

// ── Main text layer entry point ──

export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  hitBoxes: Record<string, HitBox>,
  editingId: string | null,
  onFontLoaded?: () => void,
): void {
  // ── Error boundary: a bad text layer must never crash the canvas paint ──
  try {
    renderTextLayerInternal(ctx, layer, hitBoxes, editingId, onFontLoaded);
  } catch (err) {
    console.error('[DesignLab] renderTextLayer failed for layer', layer.id, err);
    // Draw a visible error placeholder so the author knows something went wrong
    const box = hitBoxes[layer.id];
    if (box) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

function renderTextLayerInternal(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  hitBoxes: Record<string, HitBox>,
  editingId: string | null,
  onFontLoaded?: () => void,
): void {
  // ── Safe defaults for all new fields (handles old projects missing them) ──
  const fontWeight     = safeNum(layer.fontWeight, layer.isBold ? 700 : 400) as TextLayer['fontWeight'];
  const textTransform  = layer.textTransform  ?? 'none';
  const textDecoration = layer.textDecoration ?? 'none';
  const padding        = clamp(safeNum(layer.padding, 12), 0, 100);
  const fillType       = layer.fillType       ?? 'solid';
  const curveAmount    = clamp(safeNum(layer.curveAmount, 0), -360, 360);
  const letterSpacing  = clamp(safeNum(layer.letterSpacing, 0), -layer.fontSize, layer.fontSize * 2);

  // ── Font loading ──
  // Check if the font+weight is ready; if not, initiate async load and signal
  // CanvasRenderer to re-render once it's available.
  const weight = fontWeight as number;
  if (!isFontReady(layer.fontFamily, weight)) {
    loadGoogleFontAsync(layer.fontFamily, weight).then(() => {
      onFontLoaded?.();
    }).catch(() => {
      onFontLoaded?.(); // Still trigger redraw so we render with fallback
    });
  } else {
    // Pre-emptively fire-and-forget for the legacy weight too (backward compat)
    loadGoogleFont(layer.fontFamily, weight);
  }

  // ── Apply font + transform ──
  ctx.font = buildFontString(layer);

  const rawText    = layer.text || '';
  const displayText = applyTextTransform(rawText, textTransform);
  const TEXT_PAD   = padding;

  // ── Compute bounding box ──
  const maxWidth = layer.width
    ? Math.max(10, layer.width - TEXT_PAD * 2)
    : Infinity;

  const lines  = wrapText(ctx, displayText, maxWidth, letterSpacing);
  const lineH  = layer.fontSize * safeNum(layer.lineHeight, 1.2);
  const totalH = lines.length * lineH;

  let maxLineW = 0;
  for (const line of lines) {
    const w = measureTextWithSpacing(ctx, line, letterSpacing);
    if (w > maxLineW) maxLineW = w;
  }
  const boxW = layer.width ?? Math.max(maxLineW + TEXT_PAD * 2, layer.fontSize * 0.5);
  const boxH = totalH + TEXT_PAD * 2; // include top+bottom padding in hit box

  hitBoxes[layer.id] = {
    x: layer.x - boxW / 2,
    y: layer.y - boxH / 2,
    w: boxW,
    h: boxH,
  };

  // Don't draw text if currently in inline-edit mode (textarea overlay handles it)
  // Exception: curved text is NOT editable inline, so always draw it.
  if (layer.id === editingId && curveAmount === 0) return;

  // ── Apply layer transforms ──
  ctx.save();
  ctx.translate(layer.x, layer.y);
  if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipH) ctx.scale(-1, 1);
  if (layer.flipV) ctx.scale(1, -1);

  const filterStr = buildFilterString(null, layer.blur || 0, null);
  if (filterStr !== 'none') ctx.filter = filterStr;

  // ── Route to the correct renderer ──
  if (curveAmount !== 0) {
    renderCurvedText(ctx, layer, lines, lineH, totalH, boxW, letterSpacing, fillType, fontWeight, textDecoration);
  } else {
    renderStraightText(ctx, layer, lines, lineH, totalH, boxW, TEXT_PAD, letterSpacing, fillType, fontWeight, textDecoration);
  }

  ctx.restore();
}

// ── Straight text renderer ──

function renderStraightText(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  lines: string[],
  lineH: number,
  totalH: number,
  boxW: number,
  TEXT_PAD: number,
  letterSpacing: number,
  fillType: TextLayer['fillType'],
  fontWeight: TextLayer['fontWeight'],
  textDecoration: TextLayer['textDecoration'],
): void {
  ctx.textBaseline = 'middle';

  // ── Drop shadow (applied before text draw) ──
  if (layer.shadow) {
    ctx.shadowOffsetX = layer.shadow.x;
    ctx.shadowOffsetY = layer.shadow.y;
    ctx.shadowBlur    = layer.shadow.blur;
    ctx.shadowColor   = layer.shadow.color;
  }

  // ── Neon glow setup ──
  if (layer.neonGlow?.enabled) {
    applyNeonGlow(ctx, layer.neonGlow);
  }

  // ── Build fill style ──
  let fillStyle: string | CanvasGradient = layer.color || '#000000';
  if (fillType === 'gradient' || fillType === 'rainbow') {
    fillStyle = buildTextGradient(ctx, layer, boxW, totalH);
  }

  // ── Text X offsets per alignment ──
  // When using manual glyph stepping we always start at the left edge of each line.
  let textXBase = 0;
  if (layer.textAlign === 'left')       textXBase = -boxW / 2 + TEXT_PAD;
  else if (layer.textAlign === 'right') textXBase = boxW / 2 - TEXT_PAD;
  else                                  textXBase = 0; // center

  let startY = -(totalH / 2) + lineH / 2;

  // ── Stroke pass (drawn first so fill renders on top) ──
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColor || '#ffffff';
    ctx.lineWidth   = layer.strokeWidth;
    ctx.lineJoin    = 'round';
    // Suppress shadow on stroke-only pass to avoid double-shadow artifacts
    ctx.shadowColor = 'transparent';

    const strokeY = startY;
    let sy = strokeY;
    for (const line of lines) {
      const lineW = measureTextWithSpacing(ctx, line, letterSpacing);
      // For manual spacing we must switch to 'left' alignment and compute x ourselves
      const sx = getLineStartX(textXBase, lineW, layer.textAlign);
      ctx.textAlign = 'left';
      drawTextWithSpacing(ctx, line, sx, sy, letterSpacing, true);
      sy += lineH;
    }

    // Restore shadow for fill pass
    if (layer.shadow) {
      ctx.shadowOffsetX = layer.shadow.x;
      ctx.shadowOffsetY = layer.shadow.y;
      ctx.shadowBlur    = layer.shadow.blur;
      ctx.shadowColor   = layer.shadow.color;
    }
    if (layer.neonGlow?.enabled) {
      applyNeonGlow(ctx, layer.neonGlow);
    }
  }

  // ── Fill + background box + decoration pass ──
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'left'; // always left — we compute x manually for spacing

  let fy = startY;
  for (const line of lines) {
    const lineW = measureTextWithSpacing(ctx, line, letterSpacing);
    const lineX  = getLineStartX(textXBase, lineW, layer.textAlign);

    // Background box: draw per-line for per-word highlight effect
    if (layer.backgroundBox?.enabled) {
      drawLineBackgroundBox(ctx, lineX, fy, lineW, lineH, 'left', layer.backgroundBox);
    }

    drawTextWithSpacing(ctx, line, lineX, fy, letterSpacing, false);

    // Text decoration (underline / strikethrough)
    if (textDecoration !== 'none') {
      drawTextDecoration(ctx, line, lineX, fy, lineW, layer.fontSize, letterSpacing, textDecoration, 'left', layer.color || '#000000');
    }

    fy += lineH;
  }

  // ── Reset context state ──
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.textAlign   = 'left';
}

/** Returns the left-edge X for a line, accounting for textAlign. */
function getLineStartX(
  textXBase: number,
  lineW: number,
  textAlign: TextLayer['textAlign'],
): number {
  if (textAlign === 'center') return textXBase - lineW / 2;
  if (textAlign === 'right')  return textXBase - lineW;
  return textXBase; // left
}

// ── Curved text renderer ──

function renderCurvedText(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  lines: string[],
  lineH: number,
  totalH: number,
  boxW: number,
  letterSpacing: number,
  fillType: TextLayer['fillType'],
  fontWeight: TextLayer['fontWeight'],
  textDecoration: TextLayer['textDecoration'],
): void {
  // Curved text renders as a single line (join multiple lines with space)
  const singleLine = lines.join(' ');
  const curveAmount = clamp(safeNum(layer.curveAmount, 0), -360, 360);

  // Build a cache key based on all geometry-affecting properties
  const cacheKey = `${layer.id}|${curveAmount}|${layer.fontSize}|${letterSpacing}|${singleLine}`;
  const positions = getCurvePositions(ctx, singleLine, curveAmount, letterSpacing, cacheKey);

  if (positions.length === 0) return; // Fallback: curveAmount was effectively 0

  // Build fill style (gradient spans the bounding box, approximated as boxW × lineH for curve)
  let fillStyle: string | CanvasGradient = layer.color || '#000000';
  if (fillType === 'gradient' || fillType === 'rainbow') {
    fillStyle = buildTextGradient(ctx, layer, boxW, lineH);
  }

  // Drop shadow / neon glow
  if (layer.shadow) {
    ctx.shadowOffsetX = layer.shadow.x;
    ctx.shadowOffsetY = layer.shadow.y;
    ctx.shadowBlur    = layer.shadow.blur;
    ctx.shadowColor   = layer.shadow.color;
  }
  if (layer.neonGlow?.enabled) {
    applyNeonGlow(ctx, layer.neonGlow);
  }

  ctx.fillStyle   = fillStyle;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';

  // Draw each glyph individually along the arc
  for (const glyph of positions) {
    ctx.save();
    ctx.translate(glyph.x, glyph.y);
    ctx.rotate(glyph.rotation);

    // Stroke (if enabled)
    if (layer.strokeWidth > 0) {
      const savedShadow = ctx.shadowColor;
      ctx.shadowColor = 'transparent'; // suppress shadow on stroke pass
      ctx.strokeStyle = layer.strokeColor || '#ffffff';
      ctx.lineWidth   = layer.strokeWidth;
      ctx.lineJoin    = 'round';
      ctx.strokeText(glyph.char, 0, 0);
      ctx.shadowColor = savedShadow;
    }

    ctx.fillText(glyph.char, 0, 0);
    ctx.restore();
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
}

// ===== Word Wrap =====

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing: number = 0,
): string[] {
  const rawLines = text.split('\n');
  const lines: string[] = [];

  for (const raw of rawLines) {
    if (raw === '') { lines.push(''); continue; }
    const words = raw.split(' ');
    let current = '';

    for (const word of words) {
      const test    = current + (current ? ' ' : '') + word;
      const testW   = measureTextWithSpacing(ctx, test, letterSpacing);

      if (testW <= maxWidth) {
        current = test;
      } else {
        if (current) {
          lines.push(current);
          current = '';
        }
        // Word too long to fit: break by characters
        if (measureTextWithSpacing(ctx, word, letterSpacing) > maxWidth) {
          let charCurrent = '';
          for (const char of word) {
            const charTest = charCurrent + char;
            if (measureTextWithSpacing(ctx, charTest, letterSpacing) <= maxWidth) {
              charCurrent = charTest;
            } else {
              if (charCurrent) lines.push(charCurrent);
              charCurrent = char;
            }
          }
          current = charCurrent;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ===== Image Layer =====

function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  hitBoxes: Record<string, HitBox>,
  imageCache: Record<string, HTMLImageElement>,
): void {
  const img = imageCache[layer.id];
  if (!img) return;

  const drawW = img.width  * layer.scale;
  const drawH = img.height * layer.scale;

  const border    = layer.border;
  const overshoot = border?.enabled
    ? (border.thickness || 0) + (border.glowEnabled ? (border.glowRadius || 0) : 0)
    : 0;

  hitBoxes[layer.id] = {
    x: layer.x - (drawW / 2 + Math.max(0, overshoot)),
    y: layer.y - (drawH / 2 + Math.max(0, overshoot)),
    w: drawW + Math.max(0, overshoot) * 2,
    h: drawH + Math.max(0, overshoot) * 2,
  };

  ctx.save();
  ctx.translate(layer.x, layer.y);
  if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipH) ctx.scale(-1, 1);
  if (layer.flipV) ctx.scale(1, -1);

  const hasSolidBorder = border?.enabled && border.thickness > 0;
  const hasGlowOnly    = border?.enabled && border.glowEnabled && border.thickness === 0;

  if (hasSolidBorder) {
    renderImageBorder(ctx, img, drawW, drawH, border);
  }

  const filterStr = buildFilterString(layer.filters, layer.blur || 0, layer.shadow || null);
  if (filterStr !== 'none') ctx.filter = filterStr;

  if (hasGlowOnly && border.glowRadius > 0) {
    ctx.shadowColor  = border.glowColor;
    ctx.shadowBlur   = border.glowRadius;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.filter      = 'none';
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

function renderImageBorder(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  drawW: number,
  drawH: number,
  border: import('./types').ImageBorder,
): void {
  const pad  = border.thickness + (border.glowEnabled ? border.glowRadius + 4 : 0);
  const offW = Math.ceil(drawW + pad * 2);
  const offH = Math.ceil(drawH + pad * 2);

  if (offW > 4096 || offH > 4096 || offW <= 0 || offH <= 0) return;

  const silCanvas = document.createElement('canvas');
  silCanvas.width  = offW;
  silCanvas.height = offH;
  const silCtx = silCanvas.getContext('2d');
  if (!silCtx) return;

  const cx = offW / 2;
  const cy = offH / 2;
  const dx = cx - drawW / 2;
  const dy = cy - drawH / 2;

  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const ox = Math.cos(angle) * border.thickness;
    const oy = Math.sin(angle) * border.thickness;
    silCtx.drawImage(img, dx + ox, dy + oy, drawW, drawH);
  }

  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = border.color;
  silCtx.fillRect(0, 0, offW, offH);
  silCtx.globalCompositeOperation = 'source-over';

  if (border.glowEnabled && border.glowRadius > 0) {
    ctx.shadowColor  = border.glowColor;
    ctx.shadowBlur   = border.glowRadius;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.drawImage(silCanvas, -cx, -cy);

  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

// ===== Shape Layer =====

function renderShapeLayer(
  ctx: CanvasRenderingContext2D,
  layer: ShapeLayer,
  hitBoxes: Record<string, HitBox>,
): void {
  hitBoxes[layer.id] = {
    x: layer.x - layer.width / 2,
    y: layer.y - layer.height / 2,
    w: layer.width,
    h: layer.height,
  };

  ctx.save();
  ctx.translate(layer.x, layer.y);
  if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipH) ctx.scale(-1, 1);
  if (layer.flipV) ctx.scale(1, -1);

  const filterStr = buildFilterString(null, layer.blur || 0, layer.shadow || null);
  if (filterStr !== 'none') ctx.filter = filterStr;

  let fillStyle: string | CanvasGradient = layer.fill;
  if (layer.fillType === 'gradient') {
    const rad  = ((layer.gradientAngle - 90) * Math.PI) / 180;
    const half = Math.max(layer.width, layer.height) / 2;
    const grad = ctx.createLinearGradient(
      -Math.cos(rad) * half, -Math.sin(rad) * half,
       Math.cos(rad) * half,  Math.sin(rad) * half,
    );
    const stopVal = layer.gradientStop ?? 50;
    if (stopVal >= 50) {
      const c1Stop = (stopVal - 50) / 50;
      grad.addColorStop(0, layer.gradientColors[0]);
      grad.addColorStop(c1Stop, layer.gradientColors[0]);
      grad.addColorStop(1, layer.gradientColors[1]);
    } else {
      const c2Stop = 1 - (50 - stopVal) / 50;
      grad.addColorStop(0, layer.gradientColors[0]);
      grad.addColorStop(c2Stop, layer.gradientColors[1]);
      grad.addColorStop(1, layer.gradientColors[1]);
    }
    fillStyle = grad;
  }

  ctx.beginPath();
  drawShapePath(ctx, layer);

  if (layer.fillType !== 'none') {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth   = layer.strokeWidth;
    if (layer.strokeDash.length > 0) ctx.setLineDash(layer.strokeDash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawShapePath(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  const hw = layer.width / 2;
  const hh = layer.height / 2;

  switch (layer.shapeKind) {
    case 'rectangle': {
      const r = Math.min(layer.cornerRadius, hw, hh);
      if (r > 0) {
        ctx.roundRect(-hw, -hh, layer.width, layer.height, r);
      } else {
        ctx.rect(-hw, -hh, layer.width, layer.height);
      }
      break;
    }
    case 'circle':
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      break;
    case 'star': {
      const pts    = layer.starPoints;
      const outerR = Math.min(hw, hh);
      const innerR = outerR * layer.starInnerRadius;
      for (let i = 0; i < pts * 2; i++) {
        const r     = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / pts - Math.PI / 2;
        const x     = Math.cos(angle) * r;
        const y     = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'line':
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      break;
    case 'arrow': {
      const headW  = Math.min(hw * 0.8, layer.height * 0.8);
      const shaftH = hh * 0.35;
      ctx.moveTo(-hw, -shaftH);
      ctx.lineTo(hw - headW, -shaftH);
      ctx.lineTo(hw - headW, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(hw - headW, hh);
      ctx.lineTo(hw - headW, shaftH);
      ctx.lineTo(-hw, shaftH);
      ctx.closePath();
      break;
    }
    case 'heart': {
      const cx = (x: number) => ((x - 12) / 10) * hw;
      const cy = (y: number) => ((y - 12) / 9) * hh;
      ctx.moveTo(cx(12), cy(21));
      ctx.lineTo(cx(19), cy(14));
      ctx.bezierCurveTo(cx(20.49), cy(12.54), cx(22), cy(10.79), cx(22), cy(8.5));
      ctx.bezierCurveTo(cx(22), cy(5.463), cx(19.537), cy(3), cx(16.5), cy(3));
      ctx.bezierCurveTo(cx(14.74), cy(3), cx(13.5), cy(3.5), cx(12), cy(5));
      ctx.bezierCurveTo(cx(10.5), cy(3.5), cx(9.26), cy(3), cx(7.5), cy(3));
      ctx.bezierCurveTo(cx(4.463), cy(3), cx(2), cy(5.463), cx(2), cy(8.5));
      ctx.bezierCurveTo(cx(2), cy(10.79), cx(3.51), cy(12.54), cx(5), cy(14));
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      const r = Math.min(hw, hh);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
  }
}

// ===== Alignment Guides =====

function renderAlignGuides(
  ctx: CanvasRenderingContext2D,
  guides: AlignGuide[],
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);

  for (const g of guides) {
    ctx.beginPath();
    if (g.orientation === 'vertical') {
      ctx.moveTo(g.position, 0);
      ctx.lineTo(g.position, h);
    } else {
      ctx.moveTo(0, g.position);
      ctx.lineTo(w, g.position);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function renderSliceGuides(
  ctx: CanvasRenderingContext2D,
  sliceX: number,
  sliceY: number,
  w: number,
  h: number,
  zoom: number,
): void {
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth   = Math.max(1, 2 / zoom);
  ctx.setLineDash([10 / zoom, 10 / zoom]);

  if (sliceX > 1) {
    const colW = w / sliceX;
    for (let i = 1; i < sliceX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * colW, 0);
      ctx.lineTo(i * colW, h);
      ctx.stroke();
    }
  }

  if (sliceY > 1) {
    const rowH = h / sliceY;
    for (let i = 1; i < sliceY; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * rowH);
      ctx.lineTo(w, i * rowH);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ===== Export Render (clean, no selection/guides) =====

export function renderForExport(
  canvas: HTMLCanvasElement,
  project: Project,
  imageCache: Record<string, HTMLImageElement>,
  bgImageEl: HTMLImageElement | null,
  scale: number,
): void {
  const w = project.canvasWidth  * scale;
  const h = project.canvasHeight * scale;
  canvas.width  = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  renderProject(
    ctx,
    project,
    {},
    imageCache,
    bgImageEl,
    [],
    null,
    [],
    1,
    null,
    true, // isExport = true
    // No onFontLoaded callback needed for export — fonts must be pre-loaded before calling this
  );
}
