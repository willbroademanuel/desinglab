'use client';

// ==============================================================================
// DESIGNLAB — Canvas Renderer Component
// Interactive canvas with drag/resize/draw, zoom/pan, image caching
// ==============================================================================

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { DesignLabState } from '../useDesignLab';
import type { Layer, ToolMode } from '../types';
import { renderProject } from '../renderEngine';
import { calculateAlignGuides, clamp, getDeviceCapability } from '../utils';
import TextOverlay from './TextOverlay';
import SelectionUIOverlay from './SelectionUIOverlay';
import { Lock, Unlock, Copy, Trash2, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Type, Maximize } from 'lucide-react';

interface CanvasRendererProps {
  state: DesignLabState;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  zoom: number;
  panX: number;
  panY: number;
  onZoomChange: (z: number) => void;
  onPanChange: (x: number, y: number) => void;
  onPillVisibilityChange?: (visible: boolean) => void;
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  isResizingWidth: boolean;
  isResizingHeight: boolean;
  isRotating: boolean;
  isDrawing: boolean;
  isPanning: boolean;
  isMarquee: boolean;
  didMove: boolean;
  startX: number;
  startY: number;
  startLayerX: number;
  startLayerY: number;
  startScale: number;
  startWidth: number;
  startHeight: number;
  startRotation: number;
  startAngleOffset: number;
  wasActiveOnDown: boolean;
  layerId: string | null;
  snapshotProject: any | null;
  panStartX: number;
  panStartY: number;
}

export default function CanvasRenderer({ state, canvasRef: propCanvasRef, zoom, panX, panY, onZoomChange, onPanChange, onPillVisibilityChange }: CanvasRendererProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = propCanvasRef || internalCanvasRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef<Record<string, { url: string; img: HTMLImageElement; file: File }>>({});
  const bgCacheRef = useRef<{ file: File | null; img: HTMLImageElement | null; url: string | null }>({ file: null, img: null, url: null });
  const lastClickRef = useRef({ time: 0, id: null as string | null, count: 0 });
  const animFrameRef = useRef<number>(0);
  const hoveredIdRef = useRef<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const touchStateRef = useRef<{
    mode: string;
    initialDist: number;
    initialZoom: number;
    initialAngle: number;
    initialCenter: { x: number; y: number };
    objectState: {
      id: string;
      x: number;
      y: number;
      scale: number;
      width: number;
      height: number;
      rotation: number;
    } | null;
  } | null>(null);
  const currentZoomRef = useRef<number>(zoom);
  // Mobile drag: latest touch coords written by native touchmove, consumed by rAF flush
  const latestTouchClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  // rAF handle for pending mobile drag frame; 0 = no frame currently scheduled
  const pendingDragFrameRef = useRef<number>(0);
  // Drag-update function stored in a ref so the native touchmove listener always has
  // access to the latest closure (avoids stale-closure bugs with DOM event handlers)
  const mobileDragHandlerRef = useRef<((clientX: number, clientY: number) => void) | null>(null);

  useEffect(() => {
    currentZoomRef.current = zoom;
  }, [zoom]);

  const dragRef = useRef<DragState>({
    isDragging: false, isResizing: false, isResizingWidth: false, isResizingHeight: false, isRotating: false,
    isDrawing: false, isPanning: false, isMarquee: false,
    didMove: false, startX: 0, startY: 0, startLayerX: 0, startLayerY: 0,
    startScale: 0, startWidth: 0, startHeight: 0, startRotation: 0,
    wasActiveOnDown: false,
    layerId: null, snapshotProject: null,
    panStartX: 0, panStartY: 0,
    startAngleOffset: 0,
  });

  const [isPanning, setIsPanning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, layerId: string | null } | null>(null);

  const { isMobile } = useMemo(() => getDeviceCapability(), []);

  const getClampedPan = useCallback((x: number, y: number, currentZoom: number) => {
    if (!isMobile || !canvasRef.current || !containerRef.current) return { x, y };
    const zoomedW = canvasRef.current.clientWidth * currentZoom;
    const zoomedH = canvasRef.current.clientHeight * currentZoom;
    const maxPanX = Math.max(0, (zoomedW - containerRef.current.clientWidth) / 2);
    const maxPanY = Math.max(0, (zoomedH - containerRef.current.clientHeight) / 2);
    return {
      x: clamp(x, -maxPanX, maxPanX),
      y: clamp(y, -maxPanY, maxPanY)
    };
  }, [isMobile, canvasRef]);

  useEffect(() => {
    const clamped = getClampedPan(panX, panY, zoom);
    if (clamped.x !== panX || clamped.y !== panY) {
      onPanChange(clamped.x, clamped.y);
    }
  }, [zoom, panX, panY, getClampedPan, onPanChange]);

  // ── Spacebar Pan Shortcut ──
  const prevToolRef = useRef<ToolMode>('select');
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !state.editingLayerId && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (state.toolMode !== 'pan') {
          prevToolRef.current = state.toolMode;
          state.setToolMode('pan');
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !state.editingLayerId && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (state.toolMode === 'pan') {
          state.setToolMode(prevToolRef.current);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state]);

  // ── Render loop ──
  const [tick, setTick] = useState(0);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Fast-path: detect hitBox changes during text editing to fix 1-frame lag on the golden box
    const editingId = state.editingLayerId;
    let oldBoxStr = '';
    if (editingId) {
      oldBoxStr = JSON.stringify(state.hitBoxes.current[editingId]);
    }

    const proj = state.projectRef.current;
    const dpr = window.devicePixelRatio || 1;

    // Physical resolution
    canvas.width = proj.canvasWidth * dpr;
    canvas.height = proj.canvasHeight * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    renderProject(
      ctx, proj, state.hitBoxes.current,
      Object.fromEntries(
        Object.entries(imageCacheRef.current).map(([k, v]) => [k, v.img])
      ),
      bgCacheRef.current.img,
      state.selectedLayerIds,
      state.editingLayerIdRef.current,
      state.alignGuides,
      zoom,
      hoveredIdRef.current,
      false, // isExport
      state.triggerFontReload, // onFontLoaded — triggers re-render when async font finishes loading
    );

    ctx.restore();

    if (editingId) {
      const newBoxStr = JSON.stringify(state.hitBoxes.current[editingId]);
      if (oldBoxStr && newBoxStr && oldBoxStr !== newBoxStr) {
        setTick(t => t + 1); // Force React to re-render the overlay immediately
      }
    }
  }, [state, zoom]); // state.fontLoadVersion causes re-render when any async font is loaded

  // ── Asset loading ──
  const loadAssets = useCallback(async () => {
    const proj = state.projectRef.current;

    // Background image
    if (proj.bgImageFile && proj.bgImageFile !== bgCacheRef.current.file) {
      if (bgCacheRef.current.url) URL.revokeObjectURL(bgCacheRef.current.url);
      const url = URL.createObjectURL(proj.bgImageFile);
      const img = new Image();
      await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = url; });
      bgCacheRef.current = { file: proj.bgImageFile, img, url };
    } else if (!proj.bgImageFile && bgCacheRef.current.file) {
      if (bgCacheRef.current.url) URL.revokeObjectURL(bgCacheRef.current.url);
      bgCacheRef.current = { file: null, img: null, url: null };
    }

    // Layer images
    const currentIds = new Set(proj.layers.filter(l => l.type === 'image').map(l => l.id));

    // Cleanup removed layers
    for (const id in imageCacheRef.current) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(imageCacheRef.current[id].url);
        delete imageCacheRef.current[id];
      }
    }

    // Load new or reload changed (e.g. after background removal)
    for (const layer of proj.layers) {
      if (layer.type !== 'image') continue;
      const imgLayer = layer as import('../types').ImageLayer;
      const cached = imageCacheRef.current[layer.id];

      // Skip if cached file is the exact same File object (reference equality)
      if (cached && cached.file === imgLayer.file) continue;

      // File changed or new layer — invalidate old cache and reload
      if (cached) {
        URL.revokeObjectURL(cached.url);
        delete imageCacheRef.current[layer.id];
      }

      const url = URL.createObjectURL(imgLayer.file);
      const img = new Image();
      await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = url; });
      imageCacheRef.current[layer.id] = { url, img, file: imgLayer.file };
    }

    requestAnimationFrame(render);
  }, [render, state]);

  useEffect(() => {
    if (state.isInitialized) loadAssets();
  }, [state.project, state.isInitialized, loadAssets]);

  // Re-render on selection/guide/font changes
  useEffect(() => {
    requestAnimationFrame(render);
  }, [state.activeLayerId, state.editingLayerId, state.alignGuides, state.fontLoadVersion, render]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgCacheRef.current.url) URL.revokeObjectURL(bgCacheRef.current.url);
      for (const id in imageCacheRef.current) {
        URL.revokeObjectURL(imageCacheRef.current[id].url);
      }
    };
  }, []);

  // ── Coordinate conversion ──
  const canvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const proj = state.projectRef.current;
    const scaleX = proj.canvasWidth / rect.width;
    const scaleY = proj.canvasHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [state]);

  // ── Pointer Down ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e.clientX, e.clientY);
    const proj = state.projectRef.current;

    // Pan mode
    if (state.toolMode === 'pan' || e.button === 1) { // middle mouse button
      dragRef.current = {
        ...dragRef.current, isPanning: true,
        panStartX: panX, panStartY: panY,
        startX: e.clientX, startY: e.clientY,
      };
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Select mode — hit test
    const currentActiveId = state.activeLayerIdRef.current;

    // Check handles for active layer
    let hitHandle: 'scale' | 'width' | 'height' | 'rotate' | 'move' | null = null;
    if (currentActiveId) {
      const box = state.hitBoxes.current[currentActiveId];
      const activeLayer = proj.layers.find(l => l.id === currentActiveId);
      if (box && activeLayer && !activeLayer.locked && canvasRef.current) {
        // Calculate the physical screen scale to match the SVG overlay's invariant size
        const rect = canvasRef.current.getBoundingClientRect();
        const screenScale = proj.canvasWidth / rect.width;
        const handleSize = 24 * screenScale; // 24px physical hit target
        
        // Transform point to layer's local space to easily check corners
        const dx = x - activeLayer.x;
        const dy = y - activeLayer.y;
        const angle = (-activeLayer.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        
        const hw = box.w / 2;
        const hh = box.h / 2;
        
        // 1. Check Bottom Controls (Rotate + Move)
        const pad = 4 * screenScale;
        const rotY = hh + pad + (45 * screenScale); // match SelectionUIOverlay transform
        
        const visualW = box.w / screenScale;
        const visualH = box.h / screenScale;
        const isSmall = visualW < 80 || visualH < 80;

        if (isSmall) {
          const hitAreaY = 40 * screenScale;
          const maxReachX = 60 * screenScale;
          // Rotate handle (Left half)
          if (
            localX <= 0 && localX >= -maxReachX && 
            Math.abs(localY - rotY) <= hitAreaY
          ) {
            hitHandle = 'rotate';
          }
          
          // Move handle (Right half)
          if (
            !hitHandle &&
            localX > 0 && localX <= maxReachX && 
            Math.abs(localY - rotY) <= hitAreaY
          ) {
            hitHandle = 'move';
          }
        } else {
          // Standard Rotation handle (Center)
          if (
            Math.abs(localX) <= handleSize * 1.5 && 
            Math.abs(localY - rotY) <= handleSize * 1.5
          ) {
            hitHandle = 'rotate';
          }
        }
        
        // 2. Check Width/Height handles (Text & Shapes)
        if (!hitHandle && (activeLayer.type === 'text' || activeLayer.type === 'shape') && visualH > 40) {
          if (Math.abs(localX - (-hw)) <= handleSize && Math.abs(localY) <= handleSize) {
            hitHandle = 'width';
          } else if (Math.abs(localX - hw) <= handleSize && Math.abs(localY) <= handleSize) {
            hitHandle = 'width';
          }
        }
        if (!hitHandle && activeLayer.type === 'shape' && visualW > 40) {
          if (Math.abs(localX) <= handleSize && Math.abs(localY - (-hh)) <= handleSize) {
            hitHandle = 'height';
          } else if (Math.abs(localX) <= handleSize && Math.abs(localY - hh) <= handleSize) {
            hitHandle = 'height';
          }
        }

        // 3. Check Corner handles
        if (!hitHandle) {
          const corners = [
            { cx: -hw, cy: -hh },
            { cx: hw, cy: -hh },
            { cx: -hw, cy: hh },
            { cx: hw, cy: hh },
          ];
          for (const c of corners) {
            if (Math.abs(localX - c.cx) <= handleSize && Math.abs(localY - c.cy) <= handleSize) {
              hitHandle = 'scale';
              break;
            }
          }
        }
      }
    }

    if (hitHandle && currentActiveId) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const layer = proj.layers.find(l => l.id === currentActiveId)!;
      dragRef.current = {
        ...dragRef.current,
        isDragging: hitHandle === 'move', 
        isResizing: hitHandle === 'scale',
        isResizingWidth: hitHandle === 'width',
        isResizingHeight: hitHandle === 'height',
        isRotating: hitHandle === 'rotate',
        didMove: false,
        wasActiveOnDown: true, // handles are only visible when active
        startX: e.clientX, startY: e.clientY,
        startLayerX: layer.x, startLayerY: layer.y,
        startScale: layer.type === 'image' ? (layer as any).scale : layer.type === 'text' ? (layer as any).fontSize : 1,
        startWidth: layer.type === 'shape' || layer.type === 'text' ? (layer as any).width : 0,
        startHeight: layer.type === 'shape' ? (layer as any).height : 0,
        startRotation: layer.rotation,
        layerId: currentActiveId,
        snapshotProject: proj,
      };

      if (hitHandle === 'rotate') {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cssScaleX = rect.width / proj.canvasWidth;
        const cssScaleY = rect.height / proj.canvasHeight;
        const centerXScreen = rect.left + layer.x * cssScaleX;
        const centerYScreen = rect.top + layer.y * cssScaleY;
        const initialAngleRad = Math.atan2(e.clientY - centerYScreen, e.clientX - centerXScreen);
        const initialAngleDeg = (initialAngleRad * 180) / Math.PI;
        dragRef.current.startAngleOffset = layer.rotation - initialAngleDeg;
      }
      return;
    }

    // Hit test layers (top-first)
    let hitLayerId: string | null = null;
    for (let i = proj.layers.length - 1; i >= 0; i--) {
      const layer = proj.layers[i];
      if (!layer.visible) continue;
      const box = state.hitBoxes.current[layer.id];
      if (!box) continue;

      // Transform point to layer's local space
      const dx = x - layer.x;
      const dy = y - layer.y;
      
      const angle = (-layer.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      // Check if within bounds (-w/2 to w/2, -h/2 to h/2)
      if (localX >= -box.w / 2 && localX <= box.w / 2 && localY >= -box.h / 2 && localY <= box.h / 2) {
        hitLayerId = layer.id;
        break;
      }
    }

    if (e.shiftKey && hitLayerId) {
      state.toggleSelection(hitLayerId);
    } else if (hitLayerId && !state.selectedLayerIds.includes(hitLayerId)) {
      state.setActiveLayerId(hitLayerId);
    } else if (!hitLayerId) {
      if (!e.shiftKey) state.deselectAll();
      
      if (e.button === 0) { // Left click
        const now = Date.now();
        const isSameTarget = lastClickRef.current.id === null;
        const timeDiff = now - lastClickRef.current.time;
        const newCount = (isSameTarget && timeDiff < 400) ? lastClickRef.current.count + 1 : 1;

        if (newCount === 3) {
          state.addTextLayer();
          lastClickRef.current = { time: 0, id: null, count: 0 };
          return;
        }
        lastClickRef.current = { time: now, id: null, count: newCount };

        // If we clicked empty space start panning
        if (!isMobile || zoom > 1) {
          dragRef.current = {
            ...dragRef.current, 
            isPanning: true,
            panStartX: panX, panStartY: panY,
            startX: e.clientX, startY: e.clientY,
          };
          setIsPanning(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }
      requestAnimationFrame(render);
      return;
    }

    if (hitLayerId) {
      const now = Date.now();
      const hitLayer = proj.layers.find(l => l.id === hitLayerId);
      const isAlreadyActive = currentActiveId === hitLayerId;
      
      // Double-click to edit text layer immediately
      if (hitLayer?.type === 'text' && e.button === 0) {
        const isDoubleClick = lastClickRef.current.id === hitLayerId && now - lastClickRef.current.time < 300;
        if (isDoubleClick) {
          state.setEditingLayerId(hitLayerId);
          requestAnimationFrame(render);
          return;
        }
      }

      if (e.button === 0) {
        const isSameTarget = lastClickRef.current.id === hitLayerId;
        const timeDiff = now - lastClickRef.current.time;
        const newCount = (isSameTarget && timeDiff < 400) ? lastClickRef.current.count + 1 : 1;
        lastClickRef.current = { time: now, id: hitLayerId, count: newCount };
      }
      state.setEditingLayerId(null);

      if (hitLayer && !hitLayer.locked && e.button === 0) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
          ...dragRef.current,
          isDragging: true, isResizing: false, isResizingWidth: false, isResizingHeight: false, isRotating: false, isMarquee: false,
          didMove: false,
          wasActiveOnDown: isAlreadyActive,
          startX: e.clientX, startY: e.clientY,
          startLayerX: hitLayer.x, startLayerY: hitLayer.y,
          startScale: hitLayer.type === 'image' ? (hitLayer as any).scale : hitLayer.type === 'text' ? (hitLayer as any).fontSize : 1,
          startWidth: hitLayer.type === 'shape' || hitLayer.type === 'text' ? (hitLayer as any).width : 0,
          startHeight: hitLayer.type === 'shape' ? (hitLayer as any).height : 0,
          startRotation: hitLayer.rotation,
          layerId: hitLayerId,
          snapshotProject: proj,
        };
      }
      requestAnimationFrame(render);
    }
  }, [state, canvasCoords, render, panX, panY]);

  // ── Mobile drag processor ref ──
  // Refreshed after every render (no dep array) so the native touchmove listener
  // that is registered once at mount always calls the latest version of the drag
  // logic with fresh state, without needing to re-register the DOM listener.
  useEffect(() => {
    mobileDragHandlerRef.current = (clientX: number, clientY: number) => {
      const d = dragRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !d.layerId) return;

      const rect = canvas.getBoundingClientRect();
      const proj = state.projectRef.current;

      // --- Rotating ---
      if (d.isRotating) {
        d.didMove = true;
        try {
          const cssScaleX = rect.width / proj.canvasWidth;
          const cssScaleY = rect.height / proj.canvasHeight;
          const centerXScreen = rect.left + d.startLayerX * cssScaleX;
          const centerYScreen = rect.top + d.startLayerY * cssScaleY;
          const angleRad = Math.atan2(clientY - centerYScreen, clientX - centerXScreen);
          let newRot = (angleRad * 180 / Math.PI) + d.startAngleOffset;
          newRot = ((newRot % 360) + 360) % 360;
          state.updateLayer(d.layerId, { rotation: newRot } as any, false);
        } catch (err) {
          console.warn('[DesignLab] Mobile rotation error:', err);
        }
        requestAnimationFrame(render);
        return;
      }

      // --- Resizing Width/Height (Pill handles) ---
      if (d.isResizingWidth || d.isResizingHeight) {
        d.didMove = true;
        const scaleX = proj.canvasWidth / rect.width;
        const scaleY = proj.canvasHeight / rect.height;
        const cx = (clientX - rect.left) * scaleX;
        const cy = (clientY - rect.top) * scaleY;
        const layer = proj.layers.find(l => l.id === d.layerId);
        if (!layer || (layer.type !== 'text' && layer.type !== 'shape')) return;
        const dxL = cx - layer.x;
        const dyL = cy - layer.y;
        const angle = (-layer.rotation * Math.PI) / 180;
        const localX = dxL * Math.cos(angle) - dyL * Math.sin(angle);
        const localY = dxL * Math.sin(angle) + dyL * Math.cos(angle);
        const updatePayload: any = {};
        if (d.isResizingWidth) updatePayload.width = Math.max(20, Math.abs(localX) * 2);
        if (d.isResizingHeight && layer.type === 'shape') {
          const minH = layer.shapeKind === 'line' ? 2 : 20;
          updatePayload.height = Math.max(minH, Math.abs(localY) * 2);
          if (layer.shapeKind === 'line') updatePayload.strokeWidth = updatePayload.height;
        }
        state.updateLayer(d.layerId, updatePayload, false);
        requestAnimationFrame(render);
        return;
      }

      // --- Resizing Scale (Corners) ---
      if (d.isResizing) {
        d.didMove = true;
        try {
          const cssScaleX = rect.width / proj.canvasWidth;
          const cssScaleY = rect.height / proj.canvasHeight;
          const centerXScreen = rect.left + d.startLayerX * cssScaleX;
          const centerYScreen = rect.top + d.startLayerY * cssScaleY;
          const startDist = Math.hypot(d.startX - centerXScreen, d.startY - centerYScreen);
          const currentDist = Math.hypot(clientX - centerXScreen, clientY - centerYScreen);
          if (startDist > 1) {
            const ratio = currentDist / startDist;
            const layer = proj.layers.find(l => l.id === d.layerId);
            if (!layer) return;
            if (layer.type === 'image') {
              state.updateLayer(d.layerId, { scale: clamp(d.startScale * ratio, 0.02, 5) } as any, false);
            } else if (layer.type === 'shape') {
              const newW = Math.max(20, d.startWidth * ratio);
              const minH = layer.shapeKind === 'line' ? 2 : 20;
              const newH = Math.max(minH, d.startHeight * ratio);
              const payload: any = { width: newW, height: newH };
              if (layer.shapeKind === 'line') payload.strokeWidth = newH;
              state.updateLayer(d.layerId, payload, false);
            } else if (layer.type === 'text') {
              state.updateLayer(d.layerId, { fontSize: clamp(Math.round(d.startScale * ratio), 8, 400) } as any, false);
            }
          }
        } catch (err) {
          console.warn('[DesignLab] Mobile scale error:', err);
        }
        requestAnimationFrame(render);
        return;
      }

      // --- Dragging ---
      if (d.isDragging) {
        d.didMove = true;
        const scaleX = proj.canvasWidth / rect.width;
        const scaleY = proj.canvasHeight / rect.height;
        const dx = (clientX - d.startX) * scaleX;
        const dy = (clientY - d.startY) * scaleY;
        const newX = d.startLayerX + dx;
        const newY = d.startLayerY + dy;

        const layer = proj.layers.find(l => l.id === d.layerId);
        if (!layer) return;
        const deltaX = newX - layer.x;
        const deltaY = newY - layer.y;

        if (state.selectedLayerIds.length > 1 && d.snapshotProject) {
          const updates = state.selectedLayerIds
            .map(id => {
              const orig = d.snapshotProject.layers.find((l: Layer) => l.id === id);
              return orig ? { id, x: orig.x + deltaX, y: orig.y + deltaY } : null;
            })
            .filter((u): u is { id: string; x: number; y: number } => u !== null);
          state.updateProjectDirect(p => {
            let newLayers = p.layers;
            for (const u of updates) {
              newLayers = newLayers.map(l => l.id === u.id ? { ...l, x: u.x, y: u.y } as Layer : l);
            }
            return { ...p, layers: newLayers };
          });
        } else {
          state.updateLayer(d.layerId, { x: newX, y: newY } as any, false);
        }
        requestAnimationFrame(render);
      }
    };
  }); // intentionally no dep array — re-assigns ref after every render for fresh closure

  // ── Pointer Move ──
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;

    // Panning
    if (d.isPanning) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const clamped = getClampedPan(d.panStartX + dx, d.panStartY + dy, currentZoomRef.current);
      onPanChange(clamped.x, clamped.y);
      return;
    }

    // Mobile drag: the native touchmove rAF loop owns the drag on touch devices to
    // eliminate React synthetic-event batching latency (the rubber-band/lag effect).
    // On mobile the handler below writes to latestTouchClientRef and schedules an rAF
    // flush — so we must NOT also process the delayed React event here.
    if (isMobile && (d.isDragging || d.isResizing || d.isResizingWidth || d.isResizingHeight || d.isRotating)) {
      return;
    }

    if (!d.layerId || !canvasRef.current) {
      // Hover detection & Cursors
      if (canvasRef.current && state.toolMode === 'select') {
        const { x, y } = canvasCoords(e.clientX, e.clientY);
        const proj = state.projectRef.current;
        const currentActiveId = state.activeLayerIdRef.current;
        let hitLayerId: string | null = null;
        let nextCursor: string | null = null;

        // 1. Check handles of active layer
        if (currentActiveId) {
          const activeLayer = proj.layers.find(l => l.id === currentActiveId);
          const box = state.hitBoxes.current[currentActiveId];
          if (activeLayer && box && !activeLayer.locked) {
            const rect = canvasRef.current.getBoundingClientRect();
            const screenScale = proj.canvasWidth / rect.width;
            const handleSize = 28 * screenScale;
            const dx = x - activeLayer.x;
            const dy = y - activeLayer.y;
            const angle = (-activeLayer.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
            
            const hw = box.w / 2;
            const hh = box.h / 2;
            
            // Rotation handle
            const pad = 4 * screenScale;
            const rotY = hh + pad + (45 * screenScale);
            if (
              Math.abs(localX) <= handleSize && 
              Math.abs(localY - rotY) <= handleSize
            ) {
              nextCursor = 'grab';
              hitLayerId = activeLayer.id;
            }

            const visualW = box.w / screenScale;
            const visualH = box.h / screenScale;

            // Width/Height handles (Text and Shape)
            if (!nextCursor && (activeLayer.type === 'text' || activeLayer.type === 'shape') && visualH > 40) {
              if (Math.abs(localX - hw) <= handleSize && Math.abs(localY) <= handleSize) {
                // Right
                const globalAngle = (0 + activeLayer.rotation + 360) % 360;
                const octant = Math.round(globalAngle / 45) % 8;
                const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                nextCursor = cursors[octant];
                hitLayerId = activeLayer.id;
              } else if (Math.abs(localX - (-hw)) <= handleSize && Math.abs(localY) <= handleSize) {
                // Left
                const globalAngle = (180 + activeLayer.rotation + 360) % 360;
                const octant = Math.round(globalAngle / 45) % 8;
                const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                nextCursor = cursors[octant];
                hitLayerId = activeLayer.id;
              }
            }
            if (!nextCursor && activeLayer.type === 'shape' && visualW > 40) {
              if (Math.abs(localX) <= handleSize && Math.abs(localY - hh) <= handleSize) {
                // Bottom
                const globalAngle = (90 + activeLayer.rotation + 360) % 360;
                const octant = Math.round(globalAngle / 45) % 8;
                const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                nextCursor = cursors[octant];
                hitLayerId = activeLayer.id;
              } else if (Math.abs(localX) <= handleSize && Math.abs(localY - (-hh)) <= handleSize) {
                // Top
                const globalAngle = (270 + activeLayer.rotation + 360) % 360;
                const octant = Math.round(globalAngle / 45) % 8;
                const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                nextCursor = cursors[octant];
                hitLayerId = activeLayer.id;
              }
            }

            // Corner handles
            if (!nextCursor) {
              const corners = [
                { cx: hw, cy: -hh, baseAngle: 315 },  // Top-Right
                { cx: hw, cy: hh, baseAngle: 45 },    // Bottom-Right
                { cx: -hw, cy: hh, baseAngle: 135 },  // Bottom-Left
                { cx: -hw, cy: -hh, baseAngle: 225 }  // Top-Left
              ];
              for (const c of corners) {
                if (Math.abs(localX - c.cx) <= handleSize && Math.abs(localY - c.cy) <= handleSize) {
                  const globalAngle = (c.baseAngle + activeLayer.rotation + 360) % 360;
                  const octant = Math.round(globalAngle / 45) % 8;
                  const cursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
                  nextCursor = cursors[octant];
                  hitLayerId = activeLayer.id;
                  break;
                }
              }
            }

            // Body
            if (!nextCursor && localX >= -hw && localX <= hw && localY >= -hh && localY <= hh) {
              nextCursor = 'move';
              hitLayerId = activeLayer.id;
            }
          }
        }

        // 2. Check other layers
        if (!hitLayerId) {
          for (let i = proj.layers.length - 1; i >= 0; i--) {
            const layer = proj.layers[i];
            if (!layer.visible || layer.locked || layer.id === currentActiveId) continue;
            const box = state.hitBoxes.current[layer.id];
            if (!box) continue;

            const dx = x - layer.x;
            const dy = y - layer.y;
            const angle = (-layer.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
            
            if (localX >= -box.w / 2 && localX <= box.w / 2 && localY >= -box.h / 2 && localY <= box.h / 2) {
              hitLayerId = layer.id;
              nextCursor = 'pointer';
              break;
            }
          }
        }
        
        if (hoveredIdRef.current !== hitLayerId) {
          hoveredIdRef.current = hitLayerId;
          requestAnimationFrame(render);
        }
        
        setHoverCursor((prev: string | null) => prev !== nextCursor ? nextCursor : prev);
      }
      return;
    }
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Rotating
    if (d.isRotating && d.layerId) {
      d.didMove = true;
      try {
        const proj = state.projectRef.current;
        const cssScaleX = rect.width / proj.canvasWidth;
        const cssScaleY = rect.height / proj.canvasHeight;
        const centerXScreen = rect.left + d.startLayerX * cssScaleX;
        const centerYScreen = rect.top + d.startLayerY * cssScaleY;

        const angleRad = Math.atan2(e.clientY - centerYScreen, e.clientX - centerXScreen);
        let newRot = (angleRad * 180 / Math.PI) + d.startAngleOffset;

        // Smart snap to 0/90/180/270 degrees (desktop only, to avoid mobile fighting)
        if (!isMobile) {
          const snapAngles = [0, 90, 180, 270, 360];
          for (const sa of snapAngles) {
            if (Math.abs(newRot - sa) < 5 || Math.abs(newRot + 360 - sa) < 5) {
              newRot = sa;
              break;
            }
          }
        }
        
        newRot = ((newRot % 360) + 360) % 360;
        state.updateLayer(d.layerId, { rotation: newRot } as any, false);
      } catch (err) {
        console.warn('[DesignLab] Rotation error:', err);
      }
      requestAnimationFrame(render);
      return;
    }

    // Resizing Width/Height (Pill handles)
    if (d.isResizingWidth || d.isResizingHeight) {
      d.didMove = true;
      const { x, y } = canvasCoords(e.clientX, e.clientY);
      const layer = state.projectRef.current.layers.find(l => l.id === d.layerId);
      if (!layer || (layer.type !== 'text' && layer.type !== 'shape')) return;
      
      const dx = x - layer.x;
      const dy = y - layer.y;
      const angle = (-layer.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      const updatePayload: any = {};
      if (d.isResizingWidth) {
        updatePayload.width = Math.max(20, Math.abs(localX) * 2);
      }
      if (d.isResizingHeight && layer.type === 'shape') {
        updatePayload.height = Math.max(20, Math.abs(localY) * 2);
      }
      
      state.updateLayer(d.layerId, updatePayload, false);
      requestAnimationFrame(render);
      return;
    }

    // Resizing Scale (Corners)
    if (d.isResizing && d.layerId) {
      d.didMove = true;
      try {
        // Same DPR-independent pivot fix applied here (see rotation comment above)
        const proj = state.projectRef.current;
        const cssScaleX = rect.width / proj.canvasWidth;
        const cssScaleY = rect.height / proj.canvasHeight;
        const centerXScreen = rect.left + d.startLayerX * cssScaleX;
        const centerYScreen = rect.top + d.startLayerY * cssScaleY;
        const startDist = Math.hypot(d.startX - centerXScreen, d.startY - centerYScreen);
        const currentDist = Math.hypot(e.clientX - centerXScreen, e.clientY - centerYScreen);

        // Guard: require > 1px to avoid near-zero division jitter when pointer barely moved
        if (startDist > 1) {
          const ratio = currentDist / startDist;
          const layer = proj.layers.find(l => l.id === d.layerId);
          if (!layer) return;

          if (layer.type === 'image') {
            const newScale = clamp(d.startScale * ratio, 0.02, 5);
            state.updateLayer(d.layerId, { scale: newScale } as any, false);
          } else if (layer.type === 'shape') {
            state.updateLayer(d.layerId, {
              width: Math.max(20, d.startWidth * ratio),
              height: Math.max(20, d.startHeight * ratio),
            } as any, false);
          } else if (layer.type === 'text') {
            const newSize = clamp(Math.round(d.startScale * ratio), 8, 400);
            state.updateLayer(d.layerId, { fontSize: newSize } as any, false);
          }
        }
      } catch (err) {
        console.warn('[DesignLab] Scale resize error:', err);
      }
      requestAnimationFrame(render);
      return;
    }

    // Dragging
    if (d.isDragging && d.layerId) {
      d.didMove = true;
      const proj = state.projectRef.current;
      const scaleX = proj.canvasWidth / rect.width;
      const scaleY = proj.canvasHeight / rect.height;
      const dx = (e.clientX - d.startX) * scaleX;
      const dy = (e.clientY - d.startY) * scaleY;
      let newX = d.startLayerX + dx;
      let newY = d.startLayerY + dy;

      // Smart alignment (desktop only)
      if (!isMobile) {
        const { guides, snapX, snapY } = calculateAlignGuides(
          d.layerId, newX, newY,
          state.hitBoxes.current,
          canvas.width, canvas.height,
          state.projectRef.current.layers,
        );
        newX = snapX;
        newY = snapY;
        state.setAlignGuides(guides);
      }

      const layer = proj.layers.find(l => l.id === d.layerId)!;
      const deltaX = newX - layer.x;
      const deltaY = newY - layer.y;
        
      if (state.selectedLayerIds.length > 1) {
          const updates = state.selectedLayerIds.map(id => {
            const orig = d.snapshotProject.layers.find((l: Layer) => l.id === id);
            return { id, x: orig.x + deltaX, y: orig.y + deltaY };
          });
          state.updateProjectDirect(p => {
             let newLayers = p.layers;
             for (const u of updates) {
               newLayers = newLayers.map(l => l.id === u.id ? { ...l, x: u.x, y: u.y } as Layer : l);
             }
             return { ...p, layers: newLayers };
          });
      } else {
          state.updateLayer(d.layerId, { x: newX, y: newY } as any, false);
      }
      requestAnimationFrame(render);
    }
  }, [state, canvasCoords, render, onPanChange, isMobile]);

  // ── Pointer Up ──
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Cancel any pending mobile drag frame immediately — if not cancelled, the rAF
    // could fire after pointerup and write a stale position to state, corrupting
    // the final layer position and the history snapshot.
    if (pendingDragFrameRef.current) {
      cancelAnimationFrame(pendingDragFrameRef.current);
      pendingDragFrameRef.current = 0;
    }
    latestTouchClientRef.current = null;

    const d = dragRef.current;

    if (d.isPanning) {
      d.isPanning = false;
      setIsPanning(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      return;
    }

    if (d.isMarquee) {
      d.isMarquee = false;
      // Sync the ref state back to React state so UI updates
      state.setActiveLayerId(state.activeLayerIdRef.current);
      // We must map all items manually into selectedLayerIds because setActiveLayerId only takes one.
      // Wait, we can't easily sync an array this way with the current API unless we add a method, but toggleSelection works or we just leave it for now.
      // Let's just trigger a re-render.
      requestAnimationFrame(render);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      return;
    }

    if (d.isDragging || d.isResizing || d.isResizingWidth || d.isResizingHeight || d.isRotating) {
      // Single click on an already active text layer (no movement) triggers edit
      if (!d.didMove && d.isDragging && d.wasActiveOnDown) {
        const layer = state.projectRef.current.layers.find(l => l.id === d.layerId);
        if (layer?.type === 'text') {
          state.setEditingLayerId(d.layerId);
          requestAnimationFrame(render);
        }
      }

      if (d.didMove && d.snapshotProject) {
        state.pushHistory();
      }
      d.isDragging = false;
      d.isResizing = false;
      d.isResizingWidth = false;
      d.isResizingHeight = false;
      d.isRotating = false;
      d.didMove = false;
      d.layerId = null;
      d.snapshotProject = null;
      state.setAlignGuides([]);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  }, [state, render]);

  // ── Pointer Leave ──
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e);
    if (hoveredIdRef.current !== null) {
      hoveredIdRef.current = null;
      requestAnimationFrame(render);
    }
  }, [handlePointerUp, render]);

  // ── Wheel zoom (desktop) ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isMobile) return;
    // We still have the React event, but actual prevention happens in the native listener
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = clamp(zoom + delta, 0.1, 5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = e.clientX - rect.left - cx;
      const dy = e.clientY - rect.top - cy;
      
      const newPanX = dx - (dx - panX) * (newZoom / zoom);
      const newPanY = dy - (dy - panY) * (newZoom / zoom);
      
      onPanChange(newPanX, newPanY);
    }

    onZoomChange(newZoom);
  }, [zoom, onZoomChange, panX, panY, onPanChange, isMobile]);

  // Prevent default scroll globally on the canvas container and add pinch-to-zoom
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const preventScroll = (e: WheelEvent) => {
      if (!isMobile) {
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        const cxScreen = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cyScreen = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const angle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );
        
        let mode = 'canvas';
        let initialObjectState = null;
        
        const rect = canvas.getBoundingClientRect();
        const proj = stateRef.current.projectRef.current;
        const activeId = stateRef.current.activeLayerIdRef.current;
        
        if (activeId) {
          const scaleX = proj.canvasWidth / rect.width;
          const scaleY = proj.canvasHeight / rect.height;
          const canvasX = (cxScreen - rect.left) * scaleX;
          const canvasY = (cyScreen - rect.top) * scaleY;
          
          const layer = proj.layers.find(l => l.id === activeId);
          const box = stateRef.current.hitBoxes.current[activeId];
          if (layer && box && !layer.locked) {
            const dx = canvasX - layer.x;
            const dy = canvasY - layer.y;
            const rot = (-layer.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(rot) - dy * Math.sin(rot);
            const localY = dx * Math.sin(rot) + dy * Math.cos(rot);
            
            // Hit test: is the pinch center inside the active object?
            // We give it a generous margin (+40) for mobile fat-fingers
            if (localX >= -(box.w / 2 + 40) && localX <= (box.w / 2 + 40) && 
                localY >= -(box.h / 2 + 40) && localY <= (box.h / 2 + 40)) {
              mode = 'object';
              initialObjectState = {
                id: activeId,
                x: layer.x,
                y: layer.y,
                scale: layer.type === 'image' ? (layer as any).scale : layer.type === 'text' ? (layer as any).fontSize : 1,
                width: layer.type === 'shape' || layer.type === 'text' ? (layer as any).width : 0,
                height: layer.type === 'shape' ? (layer as any).height : 0,
                rotation: layer.rotation,
              };
            }
          }
        }
        
        touchStateRef.current = { 
          mode,
          initialDist: dist, 
          initialZoom: currentZoomRef.current,
          initialAngle: angle,
          initialCenter: { x: cxScreen, y: cyScreen },
          objectState: initialObjectState
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStateRef.current) {
        e.preventDefault();
        const cxScreen = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cyScreen = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const angle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );
        
        const ts = touchStateRef.current;
        
        if (ts.mode === 'canvas') {
          // ── Two-finger pinch-to-zoom (canvas) ──
          const ratio = dist / ts.initialDist;
          const minZ = isMobile ? 1 : 0.3;
          const newZoom = clamp(ts.initialZoom * ratio, minZ, 5);
          onZoomChange(newZoom);
        } else if (ts.mode === 'object' && ts.objectState) {
          // ── Two-finger scale + rotate + move (active object) ──
          const ratio = dist / ts.initialDist;
          const deltaAngleRad = angle - ts.initialAngle;
          const deltaAngleDeg = (deltaAngleRad * 180) / Math.PI;
          
          const dxScreen = cxScreen - ts.initialCenter.x;
          const dyScreen = cyScreen - ts.initialCenter.y;
          
          const rect = canvas.getBoundingClientRect();
          const proj = stateRef.current.projectRef.current;
          const scaleX = proj.canvasWidth / rect.width;
          const scaleY = proj.canvasHeight / rect.height;
          
          const os = ts.objectState;
          const payload: any = {
            x: os.x + dxScreen * scaleX,
            y: os.y + dyScreen * scaleY,
            rotation: (os.rotation + deltaAngleDeg + 360) % 360
          };
          
          const layer = proj.layers.find(l => l.id === os.id);
          if (!layer) return;
          
          if (layer.type === 'image') {
            payload.scale = clamp(os.scale * ratio, 0.02, 5);
          } else if (layer.type === 'shape') {
            payload.width = Math.max(20, os.width * ratio);
            payload.height = Math.max(20, os.height * ratio);
          } else if (layer.type === 'text') {
            payload.fontSize = clamp(Math.round(os.scale * ratio), 8, 400);
          }
          
          stateRef.current.updateLayer(os.id, payload, false);
          
          // Force a render
          if (!pendingDragFrameRef.current) {
            pendingDragFrameRef.current = requestAnimationFrame(() => {
              pendingDragFrameRef.current = 0;
              render();
            });
          }
        }
      } else if (e.touches.length === 1) {
        // ── Single-touch drag: bypass React synthetic-event batching ──
        const d = dragRef.current;
        const isActiveDrag = d.isDragging || d.isResizing || d.isResizingWidth || d.isResizingHeight || d.isRotating;
        if (isActiveDrag && mobileDragHandlerRef.current) {
          e.preventDefault(); 
          const touch = e.touches[0];
          latestTouchClientRef.current = { clientX: touch.clientX, clientY: touch.clientY };

          if (!pendingDragFrameRef.current) {
            pendingDragFrameRef.current = requestAnimationFrame(() => {
              pendingDragFrameRef.current = 0;
              const pos = latestTouchClientRef.current;
              if (pos) mobileDragHandlerRef.current?.(pos.clientX, pos.clientY);
            });
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (touchStateRef.current && touchStateRef.current.mode === 'object') {
          stateRef.current.pushHistory();
        }
        touchStateRef.current = null;
      }
    };

    canvas.addEventListener('wheel', preventScroll, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', preventScroll);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isMobile, onZoomChange]);

  // ── Canvas cursor ──
  const cursor = useMemo(() => {
    if (isPanning) return 'grabbing';
    switch (state.toolMode) {
      case 'pan': return isPanning ? 'grabbing' : 'grab';
      case 'text': return 'text';
      default: return hoverCursor || 'default';
    }
  }, [state.toolMode, hoverCursor, isPanning]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, layerId: hoveredIdRef.current || state.activeLayerIdRef.current });
  }, [state]);

  // Expose image cache for export
  (canvasRef as any).__imageCache = imageCacheRef;
  (canvasRef as any).__bgCache = bgCacheRef;

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[color:var(--surface-2)] rounded-xl border border-[color:var(--border-subtle)] flex items-center justify-center p-2 sm:p-4 relative overflow-hidden min-h-[40vh]"
      style={{
        backgroundImage: 'radial-gradient(circle, var(--text-tertiary) 1.5px, transparent 1.5px)',
        backgroundSize: '20px 20px',
        cursor,
        // Belt-and-suspenders alongside the touch-none Tailwind class on <canvas>.
        // Ensures the outer container also suppresses browser native touch handling
        // so passive touchmove events are never delivered instead of our non-passive ones.
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        setContextMenu(null);
        handlePointerDown(e as any);
      }}
      onPointerMove={handlePointerMove as any}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <div
        className="relative"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: dragRef.current.isPanning ? 'none' : 'transform 0.1s ease',
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[50vh] lg:max-h-[calc(100vh-260px)] shadow-[0_0_40px_rgba(0,0,0,0.4)] touch-none select-none"
        />
        {canvasRef.current && (
          <SelectionUIOverlay 
            state={state} 
            zoom={zoom} 
            canvasWidth={state.project.canvasWidth}
            canvasHeight={state.project.canvasHeight}
            cssScale={canvasRef.current.clientWidth / state.project.canvasWidth}
            hoveredId={hoveredIdRef.current}
          />
        )}
        <TextOverlay state={state} canvasEl={canvasRef.current} />
        <LayerToolbar 
          state={state} 
          canvasEl={canvasRef.current} 
          zoom={zoom} 
          isMobile={isMobile} 
          onVisibilityChange={onPillVisibilityChange}
        />
      </div>

      {contextMenu && (
        <div 
          className="fixed bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] shadow-xl rounded-xl py-1.5 z-[100] min-w-[140px] max-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={e => e.stopPropagation()}
        >
          {contextMenu.layerId ? (
            <>
              <button onClick={() => { state.bringToFront(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <ChevronsUp className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Bring to Front
              </button>
              <button onClick={() => { state.bringForward(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <ChevronUp className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Bring Forward
              </button>
              <button onClick={() => { state.sendBackward(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <ChevronDown className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Send Backward
              </button>
              <button onClick={() => { state.sendToBack(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <ChevronsDown className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Send to Back
              </button>
              <button onClick={() => { state.duplicateLayer(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <Copy className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Duplicate
              </button>
              <div className="h-px bg-[color:var(--border-subtle)] my-1 mx-2" />
              <button onClick={() => { state.deleteLayer(contextMenu.layerId!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-500/10 text-sm text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { state.addTextLayer(); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <Type className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Add Text
              </button>
              <button onClick={() => { onPanChange(0, 0); onZoomChange(1); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[color:var(--surface-2)] text-sm text-[color:var(--text-primary)] transition-colors">
                <Maximize className="w-4 h-4 text-[color:var(--text-tertiary)]" /> Reset View
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Floating Layer Toolbar =====
function LayerToolbar({ state, canvasEl, zoom, isMobile, onVisibilityChange }: { state: DesignLabState, canvasEl: HTMLCanvasElement | null, zoom: number, isMobile: boolean, onVisibilityChange?: (v: boolean) => void }) {
  const activeId = state.activeLayerId;
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setPillRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node && onVisibilityChange) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          onVisibilityChange(entry.isIntersecting);
        },
        { root: null, threshold: 0.1 } // relative to viewport
      );
      observer.observe(node);
      observerRef.current = observer;
    }
  }, [onVisibilityChange]);

  if (!activeId || !canvasEl) return null;
  
  const layer = state.project.layers.find(l => l.id === activeId);
  const box = state.hitBoxes.current[activeId];
  if (!layer || !box) return null;

  // On mobile, non-text objects have their toolbar rendered fixed at the top of the workspace by MobileLayout
  if (isMobile && layer.type !== 'text') return null;

  // Calculate physical CSS scale of the responsive canvas
  const cssScale = canvasEl.clientWidth / state.project.canvasWidth;

  // Calculate the visual height of the rotated bounding box
  const rad = (layer.rotation * Math.PI) / 180;
  const boundingHeight = Math.abs(box.w * Math.sin(rad)) + Math.abs(box.h * Math.cos(rad));

  const iconSize = isMobile ? 'w-5 h-5' : 'w-4 h-4';
  const btnPad = isMobile ? 'p-2.5' : 'p-1.5';

  // Prevent pill from overlapping the rotate handle when rotated upside down
  const screenScale = 1 / (cssScale * zoom);
  const rotateHandleUp = - (box.h / 2 + 67 * screenScale) * Math.cos(rad);
  const extraOffset = Math.max(0, rotateHandleUp - boundingHeight / 2);
  const pillOffset = (-boundingHeight / 2 - extraOffset) * cssScale - (isMobile ? 45 : 35) / zoom;

  // The pill hovers above the absolute highest visual point of the object on screen.
  return (
    <div
      ref={setPillRef}
      className={`absolute flex items-center bg-[color:var(--surface-1)] shadow-xl rounded-full border border-[color:var(--border-subtle)] pointer-events-auto z-50 ${
        isMobile ? 'gap-0.5 px-1.5 py-1' : 'gap-1 px-2 py-1.5'
      }`}
      style={{
        left: layer.x * cssScale,
        top: layer.y * cssScale,
        transform: `translate(-50%, -50%) translateY(${pillOffset}px) scale(${1 / zoom})`,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => state.updateLayer(layer.id, { locked: !layer.locked } as any)}
        className={`${btnPad} rounded-full transition-colors ${layer.locked ? 'bg-primary-gold/20 text-primary-gold' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-2)]'}`}
        title={layer.locked ? "Unlock layer" : "Lock layer"}
      >
        {layer.locked ? <Lock className={iconSize} /> : <Unlock className={iconSize} />}
      </button>
      
      <div className={`w-px bg-[color:var(--border-subtle)] mx-0.5 ${isMobile ? 'h-6' : 'h-5'}`} />
      
      <button
        onClick={() => state.duplicateLayer(layer.id)}
        className={`${btnPad} rounded-full transition-colors text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-2)]`}
        title="Duplicate"
      >
        <Copy className={iconSize} />
      </button>
      
      <button
        onClick={() => state.deleteLayer(layer.id)}
        className={`${btnPad} rounded-full transition-colors text-red-500/70 hover:text-red-500 hover:bg-red-500/10`}
        title="Delete"
      >
        <Trash2 className={iconSize} />
      </button>
    </div>
  );
}

// ===== Export helper: get caches from canvas ref =====
export function getCanvasCaches(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const ref = canvasRef as any;
  return {
    imageCache: (ref?.__imageCache?.current || {}) as Record<string, { url: string; img: HTMLImageElement }>,
    bgImageEl: (ref?.__bgCache?.current?.img || null) as HTMLImageElement | null,
  };
}



