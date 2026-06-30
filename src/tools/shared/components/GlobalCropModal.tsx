import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Scissors } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Rect { x: number; y: number; w: number; h: number; }
type Handle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'center' | null;

const ASPECT_RATIOS = [
  { label: 'Free', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4/3 },
  { label: '16:9', value: 16/9 },
  { label: '3:4', value: 3/4 },
  { label: '9:16', value: 9/16 },
];

interface GlobalCropModalProps {
  file: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

export function GlobalCropModal({ file, onConfirm, onCancel }: GlobalCropModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalImgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 100, h: 100 });
  const activeHandle = useRef<Handle>(null);
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => { URL.revokeObjectURL(url); };
  }, [file]);

  const loadBaseImage = useCallback(async () => {
    if (!sourceUrl || !canvasRef.current || !containerRef.current) return;

    if (!internalImgRef.current || internalImgRef.current.src !== sourceUrl) {
      const img = new Image();
      img.src = sourceUrl;
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Decode error'));
        });
        internalImgRef.current = img;
      } catch {
        setError('Failed to decode image.');
        return;
      }
    }

    const img = internalImgRef.current;
    let cw = img.width;
    let ch = img.height;

    if (rotation === 90 || rotation === 270) { cw = img.height; ch = img.width; }

    const containerRect = containerRef.current.getBoundingClientRect();
    const padding = 32;
    const maxDisplayW = Math.max(100, containerRect.width - padding);
    const maxDisplayH = Math.max(100, containerRect.height - padding);
    const ratio = Math.min(maxDisplayW / cw, maxDisplayH / ch);
    const displayW = cw * ratio;
    const displayH = ch * ratio;

    setCanvasSize({ w: displayW, h: displayH });

    let boxW = displayW;
    let boxH = aspect ? boxW / aspect : displayH;
    if (boxH > displayH) { boxH = displayH; if (aspect) boxW = boxH * aspect; }

    const newCrop = { x: (displayW - boxW) / 2, y: (displayH - boxH) / 2, w: boxW, h: boxH };
    setCrop(newCrop);
    renderVisualLayer(displayW, displayH, newCrop);
  }, [sourceUrl, rotation, aspect]);

  useEffect(() => { if (sourceUrl) loadBaseImage(); }, [sourceUrl, rotation, loadBaseImage]);

  useEffect(() => { if (canvasSize.w > 0) renderVisualLayer(); }, [flipH, flipV]);

  useEffect(() => {
    if (aspect > 0 && canvasSize.w > 0) {
      let newW = crop.w;
      let newH = newW / aspect;
      if (newH > canvasSize.h) { newH = canvasSize.h; newW = newH * aspect; }
      if (newW > canvasSize.w) { newW = canvasSize.w; newH = newW / aspect; }
      let newX = crop.x; let newY = crop.y;
      if (newX + newW > canvasSize.w) newX = canvasSize.w - newW;
      if (newY + newH > canvasSize.h) newY = canvasSize.h - newH;
      const newCrop = { x: newX, y: newY, w: newW, h: newH };
      setCrop(newCrop);
      renderVisualLayer(canvasSize.w, canvasSize.h, newCrop);
    }
  }, [aspect]);

  const renderVisualLayer = (cw = canvasSize.w, ch = canvasSize.h, cPos = crop) => {
    if (!canvasRef.current || !internalImgRef.current || cw === 0) return;
    const canvas = canvasRef.current;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = internalImgRef.current;

    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    const drawW = (rotation === 90 || rotation === 270) ? ch : cw;
    const drawH = (rotation === 90 || rotation === 270) ? cw : ch;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.rect(cPos.x, cPos.y, cPos.w, cPos.h);
    ctx.fill('evenodd');

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.strokeRect(cPos.x, cPos.y, cPos.w, cPos.h);

    const baseLen = 24; 
    const baseThick = 6;
    
    // Add drop shadow for better visibility on light backgrounds
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    const drawCornerHandle = (x: number, y: number, dirX: number, dirY: number, handleId: Handle) => {
      const isActive = activeHandle.current === handleId;
      ctx.fillStyle = isActive ? '#eab308' : '#3b82f6';
      const inflate = isActive ? 2 : 0;
      
      const len = baseLen + inflate * 2;
      const th = baseThick + inflate * 2;
      
      const cx = x - dirX * inflate;
      const cy = y - dirY * inflate;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dirX * len, cy);
      ctx.lineTo(cx + dirX * len, cy + dirY * th);
      ctx.lineTo(cx + dirX * th, cy + dirY * th);
      ctx.lineTo(cx + dirX * th, cy + dirY * len);
      ctx.lineTo(cx, cy + dirY * len);
      ctx.closePath();
      ctx.fill();
    };

    const drawEdgeHandle = (x: number, y: number, w: number, h: number, handleId: Handle) => {
      const isActive = activeHandle.current === handleId;
      ctx.fillStyle = isActive ? '#eab308' : '#3b82f6';
      const inflate = isActive ? 2 : 0;
      ctx.fillRect(x - inflate, y - inflate, w + inflate * 2, h + inflate * 2);
    };

    drawCornerHandle(cPos.x - 1, cPos.y - 1, 1, 1, 'tl');
    drawCornerHandle(cPos.x + cPos.w + 1, cPos.y - 1, -1, 1, 'tr');
    drawCornerHandle(cPos.x - 1, cPos.y + cPos.h + 1, 1, -1, 'bl');
    drawCornerHandle(cPos.x + cPos.w + 1, cPos.y + cPos.h + 1, -1, -1, 'br');

    if (aspect === 0) {
      drawEdgeHandle(cPos.x + cPos.w / 2 - baseLen / 2, cPos.y - 1, baseLen, baseThick, 't');
      drawEdgeHandle(cPos.x + cPos.w / 2 - baseLen / 2, cPos.y + cPos.h - baseThick + 1, baseLen, baseThick, 'b');
      drawEdgeHandle(cPos.x - 1, cPos.y + cPos.h / 2 - baseLen / 2, baseThick, baseLen, 'l');
      drawEdgeHandle(cPos.x + cPos.w - baseThick + 1, cPos.y + cPos.h / 2 - baseLen / 2, baseThick, baseLen, 'r');
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  };

  const getMousePos = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    // Map screen coordinate to canvas coordinate in case CSS (max-w-full) scaled the canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY,
      scaleX,
      scaleY
    };
  };

  const getHandle = (mx: number, my: number, scaleX: number, scaleY: number): Handle => {
    // Dynamic hit margin: 48 physical CSS pixels (Material Design target) 
    // mapped back to canvas coordinate space.
    const physicalTargetPx = 48;
    const marginX = (physicalTargetPx / 2) * scaleX;
    const marginY = (physicalTargetPx / 2) * scaleY;
    const margin = Math.max(marginX, marginY, 24); // Fallback min 24

    const hit = (hx: number, hy: number) => Math.abs(mx - hx) < margin && Math.abs(my - hy) < margin;
    
    // Corners first (highest priority)
    if (hit(crop.x, crop.y)) return 'tl';
    if (hit(crop.x + crop.w, crop.y)) return 'tr';
    if (hit(crop.x, crop.y + crop.h)) return 'bl';
    if (hit(crop.x + crop.w, crop.y + crop.h)) return 'br';
    
    // Edges
    if (aspect === 0) {
      if (Math.abs(my - crop.y) < margin && mx > crop.x - margin && mx < crop.x + crop.w + margin) return 't';
      if (Math.abs(my - (crop.y + crop.h)) < margin && mx > crop.x - margin && mx < crop.x + crop.w + margin) return 'b';
      if (Math.abs(mx - crop.x) < margin && my > crop.y - margin && my < crop.y + crop.h + margin) return 'l';
      if (Math.abs(mx - (crop.x + crop.w)) < margin && my > crop.y - margin && my < crop.y + crop.h + margin) return 'r';
    }
    
    // Center (lowest priority)
    if (mx > crop.x && mx < crop.x + crop.w && my > crop.y && my < crop.y + crop.h) return 'center';
    
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !containerRef.current) return;
    
    containerRef.current.setPointerCapture(e.pointerId);
    
    const pos = getMousePos(e);
    const handle = getHandle(pos.x, pos.y, pos.scaleX, pos.scaleY);
    if (!handle) return;
    
    activeHandle.current = handle;
    dragStart.current = { x: pos.x, y: pos.y, cropX: crop.x, cropY: crop.y, cropW: crop.w, cropH: crop.h };
    renderVisualLayer(); // Trigger active state visual update
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const pos = getMousePos(e);
    
    if (!activeHandle.current) {
      const h = getHandle(pos.x, pos.y, pos.scaleX, pos.scaleY);
      let cursor = 'default';
      if (h === 'tl' || h === 'br') cursor = 'nwse-resize';
      else if (h === 'tr' || h === 'bl') cursor = 'nesw-resize';
      else if (h === 't' || h === 'b') cursor = 'ns-resize';
      else if (h === 'l' || h === 'r') cursor = 'ew-resize';
      else if (h === 'center') cursor = 'move';
      containerRef.current.style.cursor = cursor;
      return;
    }

    const ds = dragStart.current;
    const dx = pos.x - ds.x;
    const dy = pos.y - ds.y;
    let newCrop = { ...crop };
    
    if (activeHandle.current === 'center') {
      newCrop.x = Math.max(0, Math.min(ds.cropX + dx, canvasSize.w - newCrop.w));
      newCrop.y = Math.max(0, Math.min(ds.cropY + dy, canvasSize.h - newCrop.h));
    } else {
      let nx = ds.cropX; let ny = ds.cropY; let nw = ds.cropW; let nh = ds.cropH;
      if (activeHandle.current === 'br') { nw += dx; nh += dy; }
      else if (activeHandle.current === 'tr') { ny += dy; nh -= dy; nw += dx; }
      else if (activeHandle.current === 'bl') { nx += dx; nw -= dx; nh += dy; }
      else if (activeHandle.current === 'tl') { nx += dx; nw -= dx; ny += dy; nh -= dy; }
      else if (activeHandle.current === 'r') { nw += dx; }
      else if (activeHandle.current === 'l') { nx += dx; nw -= dx; }
      else if (activeHandle.current === 'b') { nh += dy; }
      else if (activeHandle.current === 't') { ny += dy; nh -= dy; }
      
      if (nw < 40) { nw = 40; if (activeHandle.current?.includes('l')) nx = ds.cropX + ds.cropW - 40; }
      if (nh < 40) { nh = 40; if (activeHandle.current?.includes('t')) ny = ds.cropY + ds.cropH - 40; }
      
      if (aspect > 0) {
        if (activeHandle.current === 'br' || activeHandle.current === 'tr') { nh = nw / aspect; if (activeHandle.current === 'tr') ny = ds.cropY + ds.cropH - nh; }
        else { nw = nh * aspect; if (activeHandle.current === 'bl' || activeHandle.current === 'tl') nx = ds.cropX + ds.cropW - nw; }
      }
      
      if (nx < 0) nx = 0;
      if (ny < 0) ny = 0;
      if (nx + nw > canvasSize.w) nw = canvasSize.w - nx;
      if (ny + nh > canvasSize.h) nh = canvasSize.h - ny;
      if (aspect > 0) { if (nw / aspect > nh) nw = nh * aspect; else nh = nw / aspect; }
      
      // Safety guard against NaN/Infinity
      if (isNaN(nw) || isNaN(nh) || isNaN(nx) || isNaN(ny)) return;
      
      newCrop = { x: nx, y: ny, w: Math.max(1, nw), h: Math.max(1, nh) };
    }
    setCrop(newCrop);
    renderVisualLayer(canvasSize.w, canvasSize.h, newCrop);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle.current) {
      activeHandle.current = null;
      renderVisualLayer(); // Re-render to clear active visual state
    }
    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const executeCropAndConfirm = async () => {
    if (!sourceUrl || !internalImgRef.current) return;
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const img = internalImgRef.current!;
        let rw = img.width; let rh = img.height;
        if (rotation === 90 || rotation === 270) { rw = img.height; rh = img.width; }
        const scaleFactorX = rw / canvasSize.w;
        const scaleFactorY = rh / canvasSize.h;
        let realX = crop.x * scaleFactorX;
        let realY = crop.y * scaleFactorY;
        let realW = crop.w * scaleFactorX;
        let realH = crop.h * scaleFactorY;
        const MAX_DIM = 4096;
        let exportScale = 1;
        if (realW > MAX_DIM || realH > MAX_DIM) exportScale = Math.min(MAX_DIM / realW, MAX_DIM / realH);
        const outW = realW * exportScale;
        const outH = realH * exportScale;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const octx = outCanvas.getContext('2d');
        if (!octx) throw new Error('2D extraction failed');
        octx.save();
        octx.translate(-realX * exportScale, -realY * exportScale);
        octx.translate((rw / 2) * exportScale, (rh / 2) * exportScale);
        octx.rotate((rotation * Math.PI) / 180);
        octx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        const drawW = (rotation === 90 || rotation === 270) ? (rh * exportScale) : (rw * exportScale);
        const drawH = (rotation === 90 || rotation === 270) ? (rw * exportScale) : (rh * exportScale);
        octx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        octx.restore();
        let mimeType = 'image/jpeg'; let extension = 'jpg';
        if (file.type === 'image/png') { mimeType = 'image/png'; extension = 'png'; }
        else if (file.type === 'image/webp') { mimeType = 'image/webp'; extension = 'webp'; }
        const blob = await new Promise<Blob | null>(res => outCanvas.toBlob(res, mimeType, 0.95));
        if (!blob) throw new Error('Could not encode cropped blob.');
        const originalNameParts = file.name.split('.');
        originalNameParts.pop();
        const baseName = originalNameParts.join('.') || 'image';
        const finalFile = new File([blob], `${baseName}-cropped.${extension}`, { type: mimeType });
        onConfirm(finalFile);
      } catch {
        setError('Error during extraction. Image might be too large or corrupted.');
        setIsProcessing(false);
      }
    }, 50);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-white/10 bg-black">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Scissors className="w-5 h-5 text-primary-gold" /> Prepare Image
        </h2>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors" disabled={isProcessing}>
          <X className="w-6 h-6" />
        </button>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden flex items-center justify-center p-6 md:p-12 bg-[url('/checkered-pattern.png')] bg-repeat touch-none select-none" 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp} 
        onPointerCancel={handlePointerUp}
      >
        {error ? (
          <div role="alert" className="text-red-500 bg-red-500/10 p-4 rounded-lg font-medium border border-red-500/20 max-w-md text-center">{error}</div>
        ) : (
          <canvas
            ref={canvasRef}
            className="drop-shadow-2xl max-w-full max-h-full"
            style={{ display: canvasSize.w ? 'block' : 'none' }}
          />
        )}
      </div>
      <div className="bg-black border-t border-white/10 px-4 py-4 md:py-6 flex flex-col md:flex-row gap-4 md:items-center justify-between pb-safe">
        <div className="flex-1 flex flex-col md:flex-row items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {ASPECT_RATIOS.map(r => (
              <button key={r.label} onClick={() => setAspect(r.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${aspect === r.value ? 'bg-primary-gold text-black shadow-md' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="hidden md:block w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRotation(r => (r - 90) % 360)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors shrink-0"><RotateCcw className="w-4 h-4"/></button>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors shrink-0"><RotateCw className="w-4 h-4"/></button>
            <button onClick={() => setFlipH(f => !f)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors shrink-0"><FlipHorizontal className="w-4 h-4"/></button>
            <button onClick={() => setFlipV(f => !f)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors shrink-0"><FlipVertical className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t border-white/5 md:border-none">
          <button onClick={onCancel} disabled={isProcessing} className="flex-1 md:flex-none px-6 py-3 font-semibold text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
          <button onClick={executeCropAndConfirm} disabled={isProcessing || !!error || !sourceUrl}
            className="flex-1 md:flex-none px-6 py-3 font-bold text-black bg-primary-gold hover:bg-primary-gold/90 active:scale-95 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100">
            {isProcessing ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span> : <><Check className="w-5 h-5" /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
