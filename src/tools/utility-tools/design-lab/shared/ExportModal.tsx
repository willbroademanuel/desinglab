'use client';

// ==============================================================================
// DESIGNLAB — Export Modal
// Format (PNG/JPG/WebP), quality slider, resolution multiplier, clipboard copy
// ==============================================================================

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { X, Download, Copy, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import type { ExportFormat } from '../types';
import { renderForExport } from '../renderEngine';
import { getDeviceCapability } from '../utils';
import JSZip from 'jszip';

interface ExportModalProps {
  state: DesignLabState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

export default function ExportModal({ state, canvasRef, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportAsSlices, setExportAsSlices] = useState(state.project.sliceX > 1 || state.project.sliceY > 1);
  const { isMobile, isDesktop } = useMemo(() => getDeviceCapability(), []);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const finalW = state.project.canvasWidth * scale;
  const finalH = state.project.canvasHeight * scale;

  const getImageCache = useCallback(() => {
    const ref = canvasRef as any;
    const cache = ref?.__imageCache?.current || {};
    const imgMap: Record<string, HTMLImageElement> = {};
    for (const [k, v] of Object.entries(cache)) {
      imgMap[k] = (v as any).img;
    }
    const bgImg = ref?.__bgCache?.current?.img || null;
    return { imgMap, bgImg };
  }, [canvasRef]);

  const getMimeType = (fmt: ExportFormat) => {
    switch (fmt) {
      case 'png': return 'image/png';
      case 'jpg': return 'image/jpeg';
      case 'webp': return 'image/webp';
    }
  };

  const getFileExt = (fmt: ExportFormat) => fmt === 'jpg' ? 'jpg' : fmt;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Temporarily disabled credit deduction for exports. All exports are free for now.

      const { imgMap, bgImg } = getImageCache();
      const mime = getMimeType(format);
      const ext = getFileExt(format);

      if (exportAsSlices && (state.project.sliceX > 1 || state.project.sliceY > 1)) {
        // --- ZIP Sliced Export ---
        const zip = new JSZip();
        const cols = state.project.sliceX;
        const rows = state.project.sliceY;
        const sliceW = state.project.canvasWidth / cols;
        const sliceH = state.project.canvasHeight / rows;

        // Render full canvas once
        const fullCanvas = document.createElement('canvas');
        renderForExport(fullCanvas, state.project, imgMap, bgImg, scale);

        // We use an offscreen canvas to extract slices
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sliceW * scale;
        sliceCanvas.height = sliceH * scale;
        const sCtx = sliceCanvas.getContext('2d');
        if (!sCtx) throw new Error('Cannot get 2d context for slice');

        let sliceIndex = 1;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            sCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            // Draw cropped portion
            sCtx.drawImage(
              fullCanvas,
              x * sliceW * scale, y * sliceH * scale, sliceW * scale, sliceH * scale,
              0, 0, sliceW * scale, sliceH * scale
            );

            const blob = await new Promise<Blob | null>(resolve => sliceCanvas.toBlob(resolve, mime, quality));
            if (blob) {
              zip.file(`slice_${sliceIndex}.${ext}`, blob);
            }
            sliceIndex++;
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const { downloadMedia } = await import('@/lib/utils/downloadUtility');
      await downloadMedia(url, `designlab-carousel-${Date.now()}.zip`);
      URL.revokeObjectURL(url);

      } else {
        // --- Standard Single File Export ---
        const canvas = document.createElement('canvas');
        exportCanvasRef.current = canvas;
        renderForExport(canvas, state.project, imgMap, bgImg, scale);

        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, mime, quality);
        });

        if (!blob) throw new Error('Export failed — canvas.toBlob returned null');

        const url = URL.createObjectURL(blob);
        const { downloadMedia } = await import('@/lib/utils/downloadUtility');
      await downloadMedia(url, `designlab-export-${Date.now()}.${ext}`);
      URL.revokeObjectURL(url);
      }
      
      onClose();
    } catch (err: any) {
      console.error('[DesignLab] Export error:', err);
      alert(err.message || 'Export failed due to memory constraints. Try a smaller scale.');
    } finally {
      setExporting(false);
    }
  }, [state.project, format, quality, scale, getImageCache, onClose, exportAsSlices]);

  const handleCopyClipboard = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      const { imgMap, bgImg } = getImageCache();
      renderForExport(canvas, state.project, imgMap, bgImg, scale);

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (blob && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('[DesignLab] Clipboard copy failed:', err);
    }
  }, [state.project, scale, getImageCache]);

  const FORMATS: { value: ExportFormat; label: string; desc: string }[] = [
    { value: 'png', label: 'PNG', desc: 'Lossless, supports transparency' },
    { value: 'jpg', label: 'JPG', desc: 'Smaller file, no transparency' },
    { value: 'webp', label: 'WebP', desc: 'Modern, best compression' },
  ];

  const SCALES = isMobile ? [1] : [1, 2, 3];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[color:var(--surface-1)] rounded-2xl border border-[color:var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-[color:var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-[color:var(--text-primary)]">
              <Download className="w-5 h-5 text-primary-gold" /> Export Design
            </h2>
            <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">
              {finalW} × {finalH} px
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Format */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`p-3 flex flex-col items-center gap-1 rounded-xl border transition-all ${
                    format === f.value
                      ? 'border-primary-gold bg-primary-gold/5 shadow-sm'
                      : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] hover:border-[color:var(--text-tertiary)]'
                  }`}
                >
                  <ImageIcon className={`w-5 h-5 ${format === f.value ? 'text-primary-gold' : 'text-[color:var(--text-tertiary)]'}`} />
                  <span className="text-xs font-bold">{f.label}</span>
                  <span className="text-[9px] text-[color:var(--text-tertiary)] text-center leading-tight">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality (not for PNG) */}
          {format !== 'png' && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Quality</label>
                <span className="text-[10px] font-mono text-primary-gold">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range" min="10" max="100"
                value={Math.round(quality * 100)}
                onChange={e => setQuality(parseInt(e.target.value) / 100)}
                className="w-full accent-primary-gold"
              />
              <div className="flex justify-between text-[9px] text-[color:var(--text-tertiary)]">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>
          )}

          {/* Resolution scale (desktop only) */}
          {isDesktop && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Resolution</label>
              <div className="flex gap-2">
                {SCALES.map(s => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-2.5 flex flex-col items-center rounded-xl border transition-all ${
                      scale === s
                        ? 'border-primary-gold bg-primary-gold/5'
                        : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] hover:border-[color:var(--text-tertiary)]'
                    }`}
                  >
                    <span className="text-sm font-bold">{s}×</span>
                    <span className="text-[9px] text-[color:var(--text-tertiary)]">
                      {state.project.canvasWidth * s}×{state.project.canvasHeight * s}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Slicing Checkbox */}
          {(state.project.sliceX > 1 || state.project.sliceY > 1) && (
            <div className="flex items-center gap-3 p-3 bg-primary-gold/5 border border-primary-gold/30 rounded-xl">
              <input
                type="checkbox"
                id="exportSlices"
                checked={exportAsSlices}
                onChange={e => setExportAsSlices(e.target.checked)}
                className="w-4 h-4 accent-primary-gold cursor-pointer"
              />
              <label htmlFor="exportSlices" className="text-xs font-bold cursor-pointer text-[color:var(--text-primary)]">
                Export as {state.project.sliceX * state.project.sliceY} Slices (ZIP)
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          {/* Copy to clipboard (desktop only) */}
          {isDesktop && typeof ClipboardItem !== 'undefined' && (
            <button
              onClick={handleCopyClipboard}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-[color:var(--border-subtle)] rounded-xl font-bold text-sm text-[color:var(--text-secondary)] hover:border-primary-gold hover:text-primary-gold transition-all active:scale-[0.98]"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-[2] flex items-center justify-center gap-2 py-3 bg-primary-gold text-black font-bold rounded-xl hover:bg-yellow-500 active:scale-[0.98] transition-all shadow-sm text-sm disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}



