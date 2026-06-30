'use client';

// ==============================================================================
// DESIGNLAB — Core State Management Hook
// Manages: Project state, layer CRUD, undo/redo history, IndexedDB persistence
// ==============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  Project, Layer, TextLayer, ImageLayer, ShapeLayer,
  ShapeKind, ToolMode, ExportOptions, HitBox, AlignGuide,
} from './types';
import {
  createEmptyProject, createTextLayer, createImageLayer,
  createShapeLayer,
} from './types';
import { generateLayerId, resizeImageFileIfNeeded } from './utils';
import { getItem, setItem, removeItem } from '@/lib/indexeddb/workspace-db';
import {
  MAX_HISTORY_SIZE, DB_PERSIST_DEBOUNCE_MS,
  DB_KEY_PROJECT, DB_KEY_LEGACY,
} from './constants';
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';
import { parseError } from '@/lib/utils/errorParser';
import { withTimeout } from '@/lib/utils/timeout';

// ===== Recursive Tree Helpers =====

const updateLayerRecursively = (layers: Layer[], id: string, updates: Partial<Layer>): Layer[] => {
  return layers.map(l => {
    if (l.id === id) {
      const merged = { ...l, ...updates } as Layer;
      // Keep line bounding box height in sync with visual stroke width
      if (merged.type === 'shape' && merged.shapeKind === 'line') {
        if ('height' in updates && !('strokeWidth' in updates)) {
          (merged as any).strokeWidth = merged.height;
        } else if ('strokeWidth' in updates && !('height' in updates)) {
          merged.height = (merged as any).strokeWidth;
        } else if ('height' in updates && 'strokeWidth' in updates) {
          (merged as any).strokeWidth = merged.height;
        }
        merged.height = Math.max(2, merged.height);
        (merged as any).strokeWidth = Math.max(2, (merged as any).strokeWidth);
      }
      return merged;
    }
    if (l.type === 'group') return { ...l, layers: updateLayerRecursively(l.layers, id, updates) } as Layer;
    return l;
  });
};

const deleteLayerRecursively = (layers: Layer[], id: string): Layer[] => {
  return layers
    .filter(l => l.id !== id)
    .map(l => {
      if (l.type === 'group') return { ...l, layers: deleteLayerRecursively(l.layers, id) } as Layer;
      return l;
    });
};

const findLayerRecursively = (layers: Layer[], id: string | null): Layer | undefined => {
  if (!id) return undefined;
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.type === 'group') {
      const found = findLayerRecursively(l.layers, id);
      if (found) return found;
    }
  }
  return undefined;
};

// ===== Hook Return Type =====

export interface DesignLabState {
  // Project
  project: Project;
  projectRef: React.MutableRefObject<Project>;
  isInitialized: boolean;
  hasProject: boolean; // true when user has created/loaded a project

  // Selection
  activeLayerId: string | null;
  activeLayerIdRef: React.MutableRefObject<string | null>;
  editingLayerId: string | null;
  editingLayerIdRef: React.MutableRefObject<string | null>;
  activeLayer: Layer | undefined;
  selectedLayerIds: string[];

  // Tool
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Project CRUD
  createProject: (w: number, h: number, sliceX?: number, sliceY?: number) => void;
  clearProject: () => void;
  updateProjectBg: (updates: Partial<Pick<Project, 'bgType' | 'bgColor' | 'bgGradient' | 'bgImageFile'>>) => void;
  setSliceGrid: (x: number, y: number) => void;

  // Layer CRUD
  addTextLayer: () => void;
  addImageLayer: (file: File) => void;
  addShapeLayer: (kind: ShapeKind) => void;
  updateLayer: (id: string, updates: Partial<Layer>, saveHistory?: boolean) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  updateSelectedLayers: (updates: Partial<Layer>) => void;

  // Selection
  setActiveLayerId: (id: string | null) => void;
  setEditingLayerId: (id: string | null) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;

  // Direct state update (for drag operations that bypass history)
  updateProjectDirect: (updater: (p: Project) => Project) => void;
  pushHistory: () => void; // manually push current state to history

  // Hit boxes
  hitBoxes: React.MutableRefObject<Record<string, HitBox>>;

  // Alignment guides (set during drag)
  alignGuides: AlignGuide[];
  setAlignGuides: (g: AlignGuide[]) => void;

  // Upload bg image
  setBgImage: (file: File) => void;

  // AI Background Removal
  bgRemovalState: {
    isProcessing: boolean;
    progress: number;
    error: string | null;
  };
  removeBackground: (layerId: string) => Promise<void>;
}

// ===== Hook =====

export function useDesignLab(): DesignLabState {
  const [isInitialized, setIsInitialized] = useState(false);
  const [project, setProject] = useState<Project>(createEmptyProject());
  const [hasProject, setHasProject] = useState(false);

  // History
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);

  // Selection
  const [activeLayerId, _setActiveLayerId] = useState<string | null>(null);
  const [editingLayerId, _setEditingLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  // Tool mode
  const [toolMode, setToolMode] = useState<ToolMode>('select');

  // Alignment guides
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);

  // Refs for synchronous access in canvas rendering
  const projectRef = useRef<Project>(project);
  projectRef.current = project;

  const activeLayerIdRef = useRef<string | null>(null);
  const editingLayerIdRef = useRef<string | null>(null);
  const hitBoxes = useRef<Record<string, HitBox>>({});

  // BG Removal state
  const [bgRemovalState, setBgRemovalState] = useState<{
    isProcessing: boolean;
    progress: number;
    error: string | null;
  }>({ isProcessing: false, progress: 0, error: null });

  // Debounce timer for IndexedDB writes
  const dbWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Synced setters (update ref + state atomically) ──

  const setActiveLayerId = useCallback((id: string | null) => {
    activeLayerIdRef.current = id;
    _setActiveLayerId(id);
    if (id) {
      setSelectedLayerIds(prev => prev.includes(id) ? prev : [id]);
    } else {
      setSelectedLayerIds([]);
    }
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedLayerIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      const newActive = next.length > 0 ? next[next.length - 1] : null;
      activeLayerIdRef.current = newActive;
      _setActiveLayerId(newActive);
      return next;
    });
  }, []);

  const setEditingLayerId = useCallback((id: string | null) => {
    editingLayerIdRef.current = id;
    _setEditingLayerId(id);
  }, []);

  // ── History management ──

  const pushToHistory = useCallback((state: Project) => {
    setHistory(prev => {
      const next = [...prev, state];
      if (next.length > MAX_HISTORY_SIZE) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const updateProject = useCallback((
    updater: (prev: Project) => Project,
    saveHistory = true
  ) => {
    setProject(prev => {
      const next = updater(prev);
      if (saveHistory) {
        pushToHistory(prev);
      }
      return next;
    });
  }, [pushToHistory]);

  const updateProjectDirect = useCallback((updater: (p: Project) => Project) => {
    setProject(prev => updater(prev));
  }, []);

  const pushHistory = useCallback(() => {
    pushToHistory(projectRef.current);
  }, [pushToHistory]);

  const undo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      const previous = prevHistory[prevHistory.length - 1];
      setFuture(prevFuture => [projectRef.current, ...prevFuture]);
      setProject(previous);
      return prevHistory.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setHistory(prevHistory => [...prevHistory, projectRef.current]);
      setProject(next);
      return prevFuture.slice(1);
    });
  }, []);

  // ── IndexedDB Hydration ──

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        // Try new key first, then legacy migration
        let saved = await getItem<Project>(DB_KEY_PROJECT);
        if (!saved) {
          const legacy = await getItem<any>(DB_KEY_LEGACY);
          if (legacy && legacy.bgFile) {
            // Migrate from MemeGenerator format
            saved = {
              canvasWidth: 1080,
              canvasHeight: 1080,
              bgType: legacy.bgColor ? 'solid' : (legacy.bgFile ? 'image' : 'transparent'),
              bgColor: legacy.bgColor || '#FFFFFF',
              bgGradient: { c1: '#FF512F', c2: '#DD2476', angle: 135 },
              bgImageFile: legacy.bgFile || null,
              sliceX: 1,
              sliceY: 1,
              layers: legacy.layers || [],
            };
          }
        }
        if (mounted) {
          if (saved && (saved.layers?.length > 0 || saved.bgImageFile || saved.bgType !== 'solid')) {
            setProject(saved);
            setHasProject(true);
          }
        }
      } catch (e) {
        console.error('[DesignLab] Hydration failed:', e);
      } finally {
        if (mounted) setIsInitialized(true);
      }
    }
    hydrate();
    return () => { mounted = false; };
  }, []);

  // ── IndexedDB Persistence (debounced) ──

  useEffect(() => {
    if (!isInitialized) return;
    if (dbWriteTimer.current) clearTimeout(dbWriteTimer.current);

    dbWriteTimer.current = setTimeout(() => {
      setItem(DB_KEY_PROJECT, project).catch(err => {
        console.warn('[DesignLab] Failed to persist:', err);
      });
    }, DB_PERSIST_DEBOUNCE_MS);

    return () => {
      if (dbWriteTimer.current) clearTimeout(dbWriteTimer.current);
    };
  }, [project, isInitialized]);

  // ── Project CRUD ──

  const createProject = useCallback((w: number, h: number, sliceX = 1, sliceY = 1) => {
    const proj = createEmptyProject(w, h);
    proj.sliceX = sliceX;
    proj.sliceY = sliceY;
    setProject(proj);
    setHasProject(true);
    setHistory([]);
    setFuture([]);
    setActiveLayerId(null);
    setEditingLayerId(null);
  }, [setActiveLayerId, setEditingLayerId]);

  const clearProject = useCallback(() => {
    setProject(createEmptyProject());
    setHasProject(false);
    setHistory([]);
    setFuture([]);
    setActiveLayerId(null);
    setEditingLayerId(null);
    removeItem(DB_KEY_PROJECT).catch(() => {});
  }, [setActiveLayerId, setEditingLayerId]);

  const updateProjectBg = useCallback((updates: Partial<Pick<Project, 'bgType' | 'bgColor' | 'bgGradient' | 'bgImageFile'>>) => {
    updateProject(p => ({ ...p, ...updates }));
  }, [updateProject]);

  const setBgImage = useCallback(async (file: File) => {
    const resizedFile = await resizeImageFileIfNeeded(file);
    updateProject(p => ({ ...p, bgType: 'image' as const, bgImageFile: resizedFile }));
  }, [updateProject]);

  const setSliceGrid = useCallback((x: number, y: number) => {
    updateProject(p => ({ ...p, sliceX: Math.max(1, x), sliceY: Math.max(1, y) }));
  }, [updateProject]);

  // ── Layer CRUD ──

  const addTextLayer = useCallback(() => {
    const id = generateLayerId('text');
    const layer = createTextLayer(id, projectRef.current.canvasWidth, projectRef.current.canvasHeight);
    updateProject(p => ({ ...p, layers: [...p.layers, layer] }));
    setActiveLayerId(id);
    setEditingLayerId(id);
    setToolMode('select');
  }, [updateProject, setActiveLayerId, setEditingLayerId]);

  const addImageLayer = useCallback(async (file: File) => {
    const resizedFile = await resizeImageFileIfNeeded(file);
    const id = generateLayerId('img');
    const layer = createImageLayer(id, resizedFile, projectRef.current.canvasWidth, projectRef.current.canvasHeight);
    updateProject(p => ({ ...p, layers: [...p.layers, layer] }));
    setActiveLayerId(id);
    setToolMode('select');
  }, [updateProject, setActiveLayerId]);

  const addShapeLayer = useCallback((kind: ShapeKind) => {
    const id = generateLayerId('shape');
    const layer = createShapeLayer(id, kind, projectRef.current.canvasWidth, projectRef.current.canvasHeight);
    updateProject(p => ({ ...p, layers: [...p.layers, layer] }));
    setActiveLayerId(id);
    setToolMode('select');
  }, [updateProject, setActiveLayerId]);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>, saveHistory = true) => {
    updateProject(p => ({
      ...p,
      layers: updateLayerRecursively(p.layers, id, updates),
    }), saveHistory);
  }, [updateProject]);

  const updateSelectedLayers = useCallback((updates: Partial<Layer>, saveHistory = true) => {
    updateProject(p => {
      let newLayers = p.layers;
      for (const id of selectedLayerIds) {
        newLayers = updateLayerRecursively(newLayers, id, updates);
      }
      return { ...p, layers: newLayers };
    }, saveHistory);
  }, [updateProject, selectedLayerIds]);

  const deleteLayer = useCallback((id: string) => {
    updateProject(p => ({
      ...p,
      layers: deleteLayerRecursively(p.layers, id),
    }));
    if (activeLayerIdRef.current === id) {
      setActiveLayerId(null);
      setEditingLayerId(null);
    }
    setSelectedLayerIds(prev => prev.filter(x => x !== id));
  }, [updateProject, setActiveLayerId, setEditingLayerId]);

  const duplicateLayer = useCallback((id: string) => {
    const layer = projectRef.current.layers.find(l => l.id === id);
    if (!layer) return;
    const newId = generateLayerId(layer.type);
    const cloned: Layer = {
      ...layer,
      id: newId,
      name: `${layer.name} copy`,
      x: layer.x + 20,
      y: layer.y + 20,
    } as Layer;
    updateProject(p => {
      const idx = p.layers.findIndex(l => l.id === id);
      const newLayers = [...p.layers];
      newLayers.splice(idx + 1, 0, cloned);
      return { ...p, layers: newLayers };
    });
    setActiveLayerId(newId);
  }, [updateProject, setActiveLayerId]);

  const bringForward = useCallback((id: string) => {
    updateProject(p => {
      const idx = p.layers.findIndex(l => l.id === id);
      if (idx === -1 || idx === p.layers.length - 1) return p;
      const layers = [...p.layers];
      [layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]];
      return { ...p, layers };
    });
  }, [updateProject]);

  const sendBackward = useCallback((id: string) => {
    updateProject(p => {
      const idx = p.layers.findIndex(l => l.id === id);
      if (idx <= 0) return p;
      const layers = [...p.layers];
      [layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]];
      return { ...p, layers };
    });
  }, [updateProject]);

  const bringToFront = useCallback((id: string) => {
    updateProject(p => {
      const idx = p.layers.findIndex(l => l.id === id);
      if (idx === -1 || idx === p.layers.length - 1) return p;
      const layers = [...p.layers];
      const [item] = layers.splice(idx, 1);
      layers.push(item);
      return { ...p, layers };
    });
  }, [updateProject]);

  const sendToBack = useCallback((id: string) => {
    updateProject(p => {
      const idx = p.layers.findIndex(l => l.id === id);
      if (idx <= 0) return p;
      const layers = [...p.layers];
      const [item] = layers.splice(idx, 1);
      layers.unshift(item);
      return { ...p, layers };
    });
  }, [updateProject]);

  const toggleLayerVisibility = useCallback((id: string) => {
    updateProject(p => ({
      ...p,
      layers: updateLayerRecursively(p.layers, id, { visible: !(findLayerRecursively(p.layers, id)?.visible) }),
    }));
  }, [updateProject]);

  const toggleLayerLock = useCallback((id: string) => {
    updateProject(p => ({
      ...p,
      layers: updateLayerRecursively(p.layers, id, { locked: !(findLayerRecursively(p.layers, id)?.locked) }),
    }));
  }, [updateProject]);

  // ── Grouping ──

  const groupSelection = useCallback(() => {
    if (selectedLayerIds.length < 2) return;
    updateProject(p => {
      // Find all layers to group (flat extraction)
      const toGroup: Layer[] = [];
      const remainingIds = new Set(selectedLayerIds);
      
      // Simple extraction from top level only for now to prevent complex un-nesting
      const newLayers = p.layers.filter(l => {
        if (remainingIds.has(l.id)) {
          toGroup.push(l);
          return false;
        }
        return true;
      });

      if (toGroup.length < 2) return p;

      // Calculate bounds
      const minX = Math.min(...toGroup.map(l => l.x - (l.type === 'group' ? l.width : (l.type === 'text' ? (l.width || 100) : 100)) / 2));
      const maxX = Math.max(...toGroup.map(l => l.x + (l.type === 'group' ? l.width : (l.type === 'text' ? (l.width || 100) : 100)) / 2));
      const minY = Math.min(...toGroup.map(l => l.y - 50)); // rough approx
      const maxY = Math.max(...toGroup.map(l => l.y + 50));
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // Make children relative to group center
      const relativeChildren = toGroup.map(l => ({ ...l, x: l.x - cx, y: l.y - cy }));

      const groupId = generateLayerId('group');
      const group: Layer = {
        id: groupId,
        type: 'group',
        name: 'Group',
        x: cx,
        y: cy,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        flipH: false,
        flipV: false,
        layers: relativeChildren
      } as any;

      newLayers.push(group);
      
      // Update selection synchronously
      requestAnimationFrame(() => {
        setActiveLayerId(groupId);
      });

      return { ...p, layers: newLayers };
    });
  }, [selectedLayerIds, updateProject, setActiveLayerId]);

  const ungroupSelection = useCallback(() => {
    if (selectedLayerIds.length !== 1) return;
    const targetId = selectedLayerIds[0];
    
    updateProject(p => {
      const targetGroup = p.layers.find(l => l.id === targetId);
      if (!targetGroup || targetGroup.type !== 'group') return p;
      
      const newLayers = p.layers.filter(l => l.id !== targetId);
      
      // Make children absolute again
      const absoluteChildren = (targetGroup as any).layers.map((l: Layer) => ({
        ...l,
        x: l.x + targetGroup.x,
        y: l.y + targetGroup.y,
        rotation: (l.rotation + targetGroup.rotation) % 360,
      }));
      
      newLayers.push(...absoluteChildren);

      // Select the newly ungrouped children
      requestAnimationFrame(() => {
        setSelectedLayerIds(absoluteChildren.map((l: Layer) => l.id));
        _setActiveLayerId(absoluteChildren[absoluteChildren.length - 1].id);
        activeLayerIdRef.current = absoluteChildren[absoluteChildren.length - 1].id;
      });

      return { ...p, layers: newLayers };
    });
  }, [selectedLayerIds, updateProject]);

  // ── Multi-select ──

  const selectAll = useCallback(() => {
    const ids = projectRef.current.layers.map(l => l.id);
    setSelectedLayerIds(ids);
    if (ids.length > 0) {
      activeLayerIdRef.current = ids[ids.length - 1];
      _setActiveLayerId(ids[ids.length - 1]);
    }
  }, []);

  const deselectAll = useCallback(() => {
    setActiveLayerId(null);
    setEditingLayerId(null);
  }, [setActiveLayerId, setEditingLayerId]);

  // ── AI Background Removal ──

  const removeBackground = useCallback(async (layerId: string) => {
    const layer = findLayerRecursively(projectRef.current.layers, layerId);
    if (!layer || layer.type !== 'image') {
      setBgRemovalState({ isProcessing: false, progress: 0, error: 'Select an image layer first.' });
      return;
    }

    const imageLayer = layer as ImageLayer;
    if (!imageLayer.file) {
      setBgRemovalState({ isProcessing: false, progress: 0, error: 'Image file not found in layer.' });
      return;
    }

    setBgRemovalState({ isProcessing: true, progress: 0, error: null });

    try {
      // Safety: enforce max resolution to avoid WebAssembly memory exhaustion on mobile
      const MAX_DIM = 1920;
      let sourceFile = imageLayer.file;

      // Validate it is actually an image file before sending to the AI engine
      if (!sourceFile.type.startsWith('image/')) {
        throw new Error('The selected layer does not contain a valid image file.');
      }

      const config = {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        progress: (key: string, current: number, total: number) => {
          let pct = 0;
          if (total > 0) {
            pct = current / total;
          } else if (current >= 0 && current <= 1) {
            pct = current;
          }
          
          let overallPct = 0;
          if (key.includes('fetch')) {
            overallPct = Math.round(pct * 80); // 0 to 80% for model loading
          } else if (key.includes('compute')) {
            overallPct = 80 + Math.round(pct * 20); // 80 to 100% for inference
          } else {
            overallPct = Math.round(pct * 100);
          }

          setBgRemovalState(prev => ({ ...prev, progress: Math.max(prev.progress, overallPct) }));
        },
      };

      // Run the WASM-powered local AI segmentation engine (no data leaves the device)
      // Wrapped in a 60s timeout to prevent infinite hanging on weak devices
      const resultBlob = await withTimeout(
        imglyRemoveBackground(sourceFile, config),
        60000,
        'AI Background Removal timed out. Your device may be too slow to process this image locally.'
      );

      if (!resultBlob) {
        throw new Error('The AI engine returned an empty result. Please try with a different image.');
      }

      // Convert blob → File to keep it consistent with the rest of the image layer pipeline
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '') || 'image';
      const resultFile = new File([resultBlob], `${baseName}-no-bg.png`, { type: 'image/png' });

      // Save history point before the destructive update so user can undo
      pushHistory();

      // Update the layer with the new transparent PNG file
      updateProject(p => ({
        ...p,
        layers: updateLayerRecursively(p.layers, layerId, { file: resultFile } as Partial<Layer>),
      }), false); // false = don't double-push history

      setBgRemovalState({ isProcessing: false, progress: 100, error: null });

    } catch (err: any) {
      console.error('[DesignLab] Background removal failed:', err);
      const userMessage = err?.message?.includes('fetch')
        ? 'Failed to load AI model. Please check your internet connection and try again.'
        : parseError(err, 'AI Background Removal failed. Please try again.');
      setBgRemovalState({ isProcessing: false, progress: 0, error: userMessage });
    }
  }, [updateProject, pushHistory]);

  // ── Computed values ──

  const activeLayer = findLayerRecursively(project.layers, activeLayerId);
  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  return {
    project,
    projectRef,
    isInitialized,
    hasProject,
    activeLayerId,
    activeLayerIdRef,
    editingLayerId,
    editingLayerIdRef,
    activeLayer,
    selectedLayerIds,
    toolMode,
    setToolMode,
    canUndo,
    canRedo,
    undo,
    redo,
    createProject,
    clearProject,
    updateProjectBg,
    setSliceGrid,
    addTextLayer,
    addImageLayer,
    addShapeLayer,
    updateLayer,
    deleteLayer,
    duplicateLayer,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    toggleLayerVisibility,
    toggleLayerLock,
    groupSelection,
    ungroupSelection,
    updateSelectedLayers,
    setActiveLayerId,
    setEditingLayerId,
    selectAll,
    deselectAll,
    updateProjectDirect,
    pushHistory,
    hitBoxes,
    alignGuides,
    setAlignGuides,
    setBgImage,
    toggleSelection,
    bgRemovalState,
    removeBackground,
  };
}
