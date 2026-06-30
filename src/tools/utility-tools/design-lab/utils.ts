// ==============================================================================
// DESIGNLAB — Utility Functions
// Device detection, font loading, ID generation, alignment helpers
// ==============================================================================

import type { DeviceCapability, Layer, AlignGuide, LayerFilters, HitBox } from './types';
import { SYSTEM_FONTS, MAX_CANVAS_DIM_DESKTOP, MAX_CANVAS_DIM_MOBILE, SNAP_THRESHOLD } from './constants';

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

// ===== Google Fonts Loader =====

const _loadedFonts = new Set<string>();
let _styleEl: HTMLStyleElement | null = null;

export function loadGoogleFont(fontName: string): void {
  if (SYSTEM_FONTS.has(fontName)) return; // System font, no load needed
  if (_loadedFonts.has(fontName)) return;

  _loadedFonts.add(fontName);

  if (typeof document === 'undefined') return;

  if (!_styleEl) {
    _styleEl = document.createElement('style');
    _styleEl.id = 'designlab-fonts';
    document.head.appendChild(_styleEl);
  }

  const encodedName = fontName.replace(/\s+/g, '+');
  const importRule = `@import url('https://fonts.googleapis.com/css2?family=${encodedName}:wght@400;700;900&display=swap');`;

  _styleEl.textContent += importRule + '\n';
}

export function preloadFonts(families: string[]): void {
  families.forEach(f => loadGoogleFont(f));
}

// ===== Canvas Filter String Builder =====

export function buildFilterString(filters: LayerFilters | null, universalBlur: number = 0, shadow: { x: number; y: number; blur: number; color: string } | null = null): string {
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
// Calculate snap guides when dragging a layer

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

  // Dragged element edges & center
  const dCX = dragX;
  const dCY = dragY;
  const dLeft = dragX - dragBox.w / 2;
  const dRight = dragX + dragBox.w / 2;
  const dTop = dragY - dragBox.h / 2;
  const dBottom = dragY + dragBox.h / 2;

  // Canvas center & edges
  const targets: { label: string; cx: number; cy: number; left: number; right: number; top: number; bottom: number }[] = [
    {
      label: 'canvas',
      cx: canvasW / 2, cy: canvasH / 2,
      left: 0, right: canvasW,
      top: 0, bottom: canvasH,
    },
  ];

  // Other visible layers
  for (const layer of layers) {
    if (layer.id === draggedId || !layer.visible) continue;
    const box = hitBoxes[layer.id];
    if (!box) continue;
    targets.push({
      label: layer.id,
      cx: layer.x, cy: layer.y,
      left: layer.x - box.w / 2,
      right: layer.x + box.w / 2,
      top: layer.y - box.h / 2,
      bottom: layer.y + box.h / 2,
    });
  }

  // Check snapping for each target
  for (const t of targets) {
    // Center-to-center X
    if (Math.abs(dCX - t.cx) < SNAP_THRESHOLD) {
      snapX = t.cx;
      guides.push({ orientation: 'vertical', position: t.cx });
    }
    // Center-to-center Y
    if (Math.abs(dCY - t.cy) < SNAP_THRESHOLD) {
      snapY = t.cy;
      guides.push({ orientation: 'horizontal', position: t.cy });
    }
    // Left edge
    if (Math.abs(dLeft - t.left) < SNAP_THRESHOLD) {
      snapX = t.left + dragBox.w / 2;
      guides.push({ orientation: 'vertical', position: t.left });
    }
    // Right edge
    if (Math.abs(dRight - t.right) < SNAP_THRESHOLD) {
      snapX = t.right - dragBox.w / 2;
      guides.push({ orientation: 'vertical', position: t.right });
    }
    // Top edge
    if (Math.abs(dTop - t.top) < SNAP_THRESHOLD) {
      snapY = t.top + dragBox.h / 2;
      guides.push({ orientation: 'horizontal', position: t.top });
    }
    // Bottom edge
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
      
      // If dimensions are within bounds, return original
      if (width === img.width && height === img.height) {
        resolve(file);
        return;
      }
      
      // Otherwise resize via canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // fallback
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file); // fallback
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

