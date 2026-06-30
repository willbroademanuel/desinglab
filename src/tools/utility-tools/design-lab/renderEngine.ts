// ==============================================================================
// DESIGNLAB — Canvas Rendering Engine
// Pure functions for drawing layers to a canvas context
// ==============================================================================

import type {
  Project, Layer, TextLayer, ImageLayer, ShapeLayer,
  HitBox, AlignGuide,
} from './types';
import { buildFilterString, loadGoogleFont } from './utils';

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
): void {
  const { canvasWidth: w, canvasHeight: h } = project;

  ctx.clearRect(0, 0, w, h);

  // ── Background ──
  renderBackground(ctx, project, bgImageEl, w, h, isExport);

  // ── Clear hit boxes ──
  for (const key in hitBoxes) delete hitBoxes[key];

  // ── Render Layer Tree Recursively ──
  function renderLayerTree(layers: Layer[], parentX = 0, parentY = 0) {
    // We iterate from bottom to top. If we hit a mask, we save context and clip.
    // At the end of the group, we restore context to clear the mask.
    let maskApplied = false;

    for (const layer of layers) {
      if (!layer.visible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      // Draw the layer itself
      switch (layer.type) {
        case 'text':
          renderTextLayer(ctx, layer, hitBoxes, editingId);
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
            h: layer.height
          };

          renderLayerTree(layer.layers);
          break;
      }

      ctx.restore(); // restore opacity/transforms for the individual layer

      // If THIS layer is a mask, we apply a clipping path to the PARENT context!
      if (layer.isMask && !maskApplied) {
        maskApplied = true;
        ctx.save(); // Save the group's unclipped state
        
        // Translate to the mask's position to define the clip path
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
        
        // Restore transform back to group space, but KEEP the clip active!
        ctx.rotate((-layer.rotation * Math.PI) / 180);
        ctx.translate(-layer.x, -layer.y);
      }

      // ── Hover & Selection outlines ──
      // (Moved to SVG overlay in CanvasRenderer for proper viewport overflow)
    }

    if (maskApplied) {
      ctx.restore(); // Remove the group-level clipping mask
    }
  }

  renderLayerTree(project.layers);

  // ── Super Bounding Box for Multi-Selection ──
  // (Moved to SVG overlay)

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
      // Draw checkerboard pattern only when viewing in the editor, not when exporting
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

// ===== Text Layer =====

export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  hitBoxes: Record<string, HitBox>,
  editingId: string | null,
): void {
  loadGoogleFont(layer.fontFamily);

  const weight = layer.isBold ? 'bold' : 'normal';
  const style = layer.isItalic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
  (ctx as any).letterSpacing = layer.letterSpacing > 0 ? `${layer.letterSpacing}px` : 'normal';

  const TEXT_PADDING = 12; // Breathing space so text doesn't hug the bounding box

  // FIX: Auto-width text (layer.width is undefined) should grow infinitely horizontally until 
  // the user manually resizes the bounding box (which sets layer.width).
  const maxWidth = layer.width ? Math.max(10, layer.width - (TEXT_PADDING * 2)) : Infinity;
  const lines = wrapText(ctx, layer.text, maxWidth);
  const lineH = layer.fontSize * layer.lineHeight;
  const totalH = lines.length * lineH;

  let maxLineW = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxLineW) maxLineW = m.width;
  }
  const boxW = layer.width ?? Math.max(maxLineW + (TEXT_PADDING * 2), layer.fontSize * 0.5);
  const boxH = totalH;

  // Hit box
  hitBoxes[layer.id] = {
    x: layer.x - boxW / 2,
    y: layer.y - boxH / 2,
    w: boxW,
    h: boxH,
  };

  // Don't draw text if currently editing (textarea overlay handles it)
  if (layer.id === editingId) return;

  // Apply transforms
  ctx.save();
  ctx.translate(layer.x, layer.y);
  if (layer.rotation !== 0) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flipH) ctx.scale(-1, 1);
  if (layer.flipV) ctx.scale(1, -1);

  const filterStr = buildFilterString(null, layer.blur || 0, null);
  if (filterStr !== 'none') ctx.filter = filterStr;

  ctx.textAlign = layer.textAlign;
  ctx.textBaseline = 'middle';

  // Shadow
  if (layer.shadow) {
    ctx.shadowOffsetX = layer.shadow.x;
    ctx.shadowOffsetY = layer.shadow.y;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowColor = layer.shadow.color;
  }

  // Text X based on alignment
  let textX = 0;
  if (layer.textAlign === 'left') textX = -boxW / 2 + TEXT_PADDING;
  else if (layer.textAlign === 'right') textX = boxW / 2 - TEXT_PADDING;

  let startY = -(totalH / 2) + lineH / 2;

  // Stroke
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColor;
    ctx.lineWidth = layer.strokeWidth;
    ctx.lineJoin = 'round';
    // Reset shadow for stroke to avoid double-shadow
    ctx.shadowColor = 'transparent';
    for (const line of lines) {
      ctx.strokeText(line, textX, startY);
      startY += lineH;
    }
    // Restore shadow for fill
    if (layer.shadow) {
      ctx.shadowOffsetX = layer.shadow.x;
      ctx.shadowOffsetY = layer.shadow.y;
      ctx.shadowBlur = layer.shadow.blur;
      ctx.shadowColor = layer.shadow.color;
    }
    startY = -(totalH / 2) + lineH / 2;
  }

  // Fill
  ctx.fillStyle = layer.color;
  for (const line of lines) {
    ctx.fillText(line, textX, startY);
    startY += lineH;
  }

  ctx.restore();
  (ctx as any).letterSpacing = 'normal';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const rawLines = text.split('\n');
  const lines: string[] = [];
  
  for (const raw of rawLines) {
    if (raw === '') { lines.push(''); continue; }
    const words = raw.split(' ');
    let current = '';
    
    for (const word of words) {
      const test = current + (current ? ' ' : '') + word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) {
          lines.push(current);
          current = '';
        }
        // Deal with the word itself
        if (ctx.measureText(word).width > maxWidth) {
          // Word is too long to fit on a single line, break by characters
          let charCurrent = '';
          for (const char of word) {
            const charTest = charCurrent + char;
            if (ctx.measureText(charTest).width <= maxWidth) {
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
    if (current) {
      lines.push(current);
    }
  }
  return lines;
}

function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: ImageLayer,
  hitBoxes: Record<string, HitBox>,
  imageCache: Record<string, HTMLImageElement>,
): void {
  const img = imageCache[layer.id];
  if (!img) return;

  const drawW = img.width * layer.scale;
  const drawH = img.height * layer.scale;

  // Expand hit box to include border/glow overshoot
  const border = layer.border;
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
  const hasGlowOnly = border?.enabled && border.glowEnabled && border.thickness === 0;

  // ── Solid Border (and its glow) ──
  // Drawn BEFORE filters so border colors are exact and not distorted
  if (hasSolidBorder) {
    renderImageBorder(ctx, img, drawW, drawH, border);
  }

  // Per-layer filters, plus universal blur and shadow
  const filterStr = buildFilterString(layer.filters, layer.blur || 0, layer.shadow || null);
  if (filterStr !== 'none') ctx.filter = filterStr;

  // ── Glow Only (no solid border) ──
  // If there's no solid border, apply the glow shadow directly to the image
  if (hasGlowOnly && border.glowRadius > 0) {
    ctx.shadowColor = border.glowColor;
    ctx.shadowBlur = border.glowRadius;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

// ── Offscreen silhouette border for transparent images ──

function renderImageBorder(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  drawW: number,
  drawH: number,
  border: import('./types').ImageBorder,
): void {
  // Padding to accommodate border + glow without clipping
  const pad = border.thickness + (border.glowEnabled ? border.glowRadius + 4 : 0);
  
  // Exact dimensions to prevent sub-pixel misalignment
  const offW = Math.ceil(drawW + pad * 2);
  const offH = Math.ceil(drawH + pad * 2);

  // Safety: don't create huge canvases
  if (offW > 4096 || offH > 4096 || offW <= 0 || offH <= 0) return;

  const silCanvas = document.createElement('canvas');
  silCanvas.width = offW;
  silCanvas.height = offH;
  const silCtx = silCanvas.getContext('2d');
  if (!silCtx) return;

  const cx = offW / 2;
  const cy = offH / 2;
  
  // Exactly center the image in the silhouette canvas
  const dx = cx - drawW / 2;
  const dy = cy - drawH / 2;

  // 1. Stamp image to create a single merged expanded silhouette
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const ox = Math.cos(angle) * border.thickness;
    const oy = Math.sin(angle) * border.thickness;
    silCtx.drawImage(img, dx + ox, dy + oy, drawW, drawH);
  }

  // 2. Colorize silhouette (keeps alpha mask, turns everything to border color)
  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = border.color;
  silCtx.fillRect(0, 0, offW, offH);
  silCtx.globalCompositeOperation = 'source-over';

  // 3. Draw to main canvas with optional glow
  if (border.glowEnabled && border.glowRadius > 0) {
    ctx.shadowColor = border.glowColor;
    ctx.shadowBlur = border.glowRadius;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.drawImage(silCanvas, -cx, -cy);
  
  // Reset shadow so it doesn't affect subsequent draws
  ctx.shadowBlur = 0;
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

  // Build fill style
  let fillStyle: string | CanvasGradient = layer.fill;
  if (layer.fillType === 'gradient') {
    const rad = ((layer.gradientAngle - 90) * Math.PI) / 180;
    const half = Math.max(layer.width, layer.height) / 2;
    const grad = ctx.createLinearGradient(
      -Math.cos(rad) * half, -Math.sin(rad) * half,
      Math.cos(rad) * half, Math.sin(rad) * half,
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

  // Draw shape path
  ctx.beginPath();
  drawShapePath(ctx, layer);

  // Fill
  if (layer.fillType !== 'none') {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  // Stroke
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
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
      const pts = layer.starPoints;
      const outerR = Math.min(hw, hh);
      const innerR = outerR * layer.starInnerRadius;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / pts - Math.PI / 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'line':
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      break;
    case 'arrow': {
      // Cap the arrowhead width relative to height to prevent stretching
      const headW = Math.min(hw * 0.8, layer.height * 0.8); 
      const shaftH = hh * 0.35; // Shaft half-height
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
      // Map 24x24 Lucide heart coordinates to [-hw, hw], [-hh, hh]
      // Min X: 2, Max X: 22 (Range 20, Center 12) => mapped to [-hw, hw]
      // Min Y: 3, Max Y: 21 (Range 18, Center 12) => mapped to [-hh, hh]
      const cx = (x: number) => ((x - 12) / 10) * hw;
      const cy = (y: number) => ((y - 12) / 9) * hh;

      ctx.moveTo(cx(12), cy(21)); // Bottom tip
      
      // Right side
      ctx.lineTo(cx(19), cy(14));
      ctx.bezierCurveTo(cx(20.49), cy(12.54), cx(22), cy(10.79), cx(22), cy(8.5));
      ctx.bezierCurveTo(cx(22), cy(5.463), cx(19.537), cy(3), cx(16.5), cy(3));
      ctx.bezierCurveTo(cx(14.74), cy(3), cx(13.5), cy(3.5), cx(12), cy(5));
      
      // Left side (mirrored)
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
        else ctx.lineTo(x, y);
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
  ctx.lineWidth = 1;
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
  ctx.strokeStyle = '#ef4444'; // Red for high visibility
  ctx.lineWidth = Math.max(1, 2 / zoom); // Scale thickness with zoom
  ctx.setLineDash([10 / zoom, 10 / zoom]);

  // Vertical slices
  if (sliceX > 1) {
    const colW = w / sliceX;
    for (let i = 1; i < sliceX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * colW, 0);
      ctx.lineTo(i * colW, h);
      ctx.stroke();
    }
  }

  // Horizontal slices
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
  const w = project.canvasWidth * scale;
  const h = project.canvasHeight * scale;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  const hitBoxes: Record<string, HitBox> = {};
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
    true // isExport = true
  );
}
