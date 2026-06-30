'use client';

// ==============================================================================
// DESIGNLAB — Layer Panel
// Layer list with ordering, visibility, lock, and selection
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Type, Image as ImageIcon, Square, Pen, Folder, FolderOpen,
  Eye, EyeOff, Lock, Unlock,
  Copy, Trash2, GripVertical, CheckSquare, Square as SquareOutline,
  ArrowUpToLine, ArrowDownToLine
} from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import type { DesignLabState } from '../useDesignLab';
import type { Layer, TextLayer, GroupLayer } from '../types';

interface LayerPanelProps {
  state: DesignLabState;
}

function getLayerIcon(layer: Layer) {
  switch (layer.type as string) {
    case 'text': return Type;
    case 'image': return ImageIcon;
    case 'shape': return Square;
    case 'drawing': return Pen;
    case 'group': return Folder;
    default: return Square;
  }
}

function getLayerLabel(layer: Layer): string {
  if (layer.type === 'text') return (layer as TextLayer).text.split('\n')[0] || 'Text';
  if (layer.type === 'group') return layer.name || 'Group';
  return layer.name || layer.type;
}

function LayerNode({ layer, state, depth, isTopLevel }: any) {
  const isSelected = state.selectedLayerIds.includes(layer.id);
  const Icon = layer.type === 'group' ? (isSelected ? FolderOpen : Folder) : getLayerIcon(layer);
  const [expanded, setExpanded] = useState(true);

  // Drag controls for enterprise-grade scroll vs drag detection
  const controls = useDragControls();
  const [isHolding, setIsHolding] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);

  const startDrag = (e: React.PointerEvent | PointerEvent) => {
    controls.start(e as any);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !isTopLevel) return; // Only primary click on top-level items
    
    // Store starting position to detect scrolling intent
    startY.current = e.clientY;
    startX.current = e.clientX;
    
    // We capture the native event to pass to framer-motion since React synthetic events are pooled/nulled
    const nativeEvent = e.nativeEvent;
    
    // Add a 300ms delay. If user moves finger >5px (scrolling), we cancel this timeout.
    timeoutRef.current = setTimeout(() => {
      setIsHolding(true);
      if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback for "pill lifted"
      startDrag(nativeEvent);
    }, 300);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (timeoutRef.current) {
      const dx = Math.abs(e.clientX - startX.current);
      const dy = Math.abs(e.clientY - startY.current);
      // If user moves more than 5px before 300ms, they are scrolling. Cancel drag intent.
      if (dx > 5 || dy > 5) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  const onPointerUp = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (isHolding) {
      setIsHolding(false);
      // Commit the history state after drop is complete
      state.pushHistory();
    }
  };

  const content = (
    <div className="w-full">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer select-none min-w-0 min-h-[44px] ${
          isSelected
            ? 'border-primary-gold bg-primary-gold/5 shadow-sm'
            : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] hover:border-[color:var(--text-tertiary)]'
        }`}
        style={{ width: `calc(100% - ${depth * 12}px)`, marginLeft: `${depth * 12}px`, touchAction: 'none' }}
        onClick={(e) => {
          if (e.shiftKey) state.toggleSelection(layer.id);
          else state.setActiveLayerId(layer.id);
        }}
      >
        {/* Desktop: Vertical Arrows (Left) */}
        <div className="hidden sm:flex flex-col items-center gap-0.5 opacity-50 hover:opacity-100 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); state.bringForward(layer.id); state.pushHistory(); }}
            className="hover:text-primary-gold p-0.5 rounded"
            title="Move Up"
          >
            <ArrowUpToLine className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); state.sendBackward(layer.id); state.pushHistory(); }}
            className="hover:text-primary-gold p-0.5 rounded"
            title="Move Down"
          >
            <ArrowDownToLine className="w-3 h-3" />
          </button>
        </div>

        {/* Mobile: Delete Button (Left) */}
        <button 
          onClick={e => { e.stopPropagation(); state.deleteLayer(layer.id); }} 
          className={`flex sm:hidden p-1.5 rounded-md hover:bg-red-500/10 text-red-500 shrink-0 ${isSelected ? '' : 'opacity-0 pointer-events-none absolute -z-10'}`} 
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        
        {/* Mask toggle for groups/shapes */}
        {(layer.type === 'shape' || layer.type === 'image') && (
           <button 
             onClick={e => { e.stopPropagation(); state.updateLayer(layer.id, { isMask: !layer.isMask }); }}
             className={`p-0.5 rounded ${layer.isMask ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:bg-[color:var(--border-subtle)]'}`}
             title={layer.isMask ? 'Disable Mask' : 'Use as Mask'}
           >
             {layer.isMask ? <CheckSquare className="w-3 h-3" /> : <SquareOutline className="w-3 h-3" />}
           </button>
        )}

        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary-gold' : 'text-[color:var(--text-tertiary)]'}`} />

        <span className={`text-xs font-semibold truncate flex-1 min-w-0 ${
          isSelected ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'
        } ${!layer.visible ? 'opacity-40 line-through' : ''}`}>
          {getLayerLabel(layer)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={e => { e.stopPropagation(); state.toggleLayerVisibility(layer.id); }} className="hidden sm:block p-1 rounded-md hover:bg-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] shrink-0" title={layer.visible ? 'Hide' : 'Show'}>
            {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
          </button>
          <button onClick={e => { e.stopPropagation(); state.toggleLayerLock(layer.id); }} className={`hidden sm:block p-1 rounded-md hover:bg-[color:var(--border-subtle)] shrink-0 ${layer.locked ? 'text-orange-500' : 'text-[color:var(--text-tertiary)]'}`} title={layer.locked ? 'Unlock' : 'Lock'}>
            {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          
          <button 
            onClick={e => { e.stopPropagation(); state.duplicateLayer(layer.id); }} 
            className={`p-1.5 rounded-md hover:bg-primary-gold/10 text-primary-gold shrink-0 ${isSelected ? '' : 'opacity-0 pointer-events-none'}`} 
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          {/* Desktop: Delete (Right) */}
          <button 
            onClick={e => { e.stopPropagation(); state.deleteLayer(layer.id); }} 
            className={`hidden sm:flex p-1.5 rounded-md hover:bg-red-500/10 text-red-500 shrink-0 ${isSelected ? '' : 'opacity-0 pointer-events-none'}`} 
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Mobile: Horizontal Arrows (Right) */}
          <div className={`flex sm:hidden items-center gap-1 ml-1 shrink-0 ${isSelected ? 'opacity-70' : 'opacity-0 pointer-events-none absolute -z-10'}`}>
            <button 
              onClick={(e) => { e.stopPropagation(); state.bringForward(layer.id); state.pushHistory(); }}
              className="p-1.5 rounded-md bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:text-primary-gold"
              title="Move Up"
            >
              <ArrowUpToLine className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); state.sendBackward(layer.id); state.pushHistory(); }}
              className="p-1.5 rounded-md bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:text-primary-gold"
              title="Move Down"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Render children recursively if group */}
      {layer.type === 'group' && expanded && (
        <div className="mt-1 space-y-1">
          {layer.layers.slice().reverse().map((child: Layer) => (
            <LayerNode key={child.id} layer={child} state={state} depth={depth + 1} isTopLevel={false} />
          ))}
        </div>
      )}
    </div>
  );

  // Only wrap top-level items in Reorder.Item to allow drag-and-drop
  if (isTopLevel) {
    return (
      <Reorder.Item 
        value={layer} 
        id={layer.id}
        dragListener={false} // We manually trigger drag using useDragControls to allow robust scrolling
        dragControls={controls}
        whileDrag={{ 
          scale: 1.05, 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          zIndex: 50,
          cursor: 'grabbing'
        }}
        className="relative w-full"
      >
        {content}
      </Reorder.Item>
    );
  }

  return content;
}

export default function LayerPanel({ state }: LayerPanelProps) {
  const layers = state.project.layers;
  const [items, setItems] = useState<Layer[]>([]);

  // Sync state to local items, reversing for visual display (top layer visually on top)
  useEffect(() => {
    setItems(layers.slice().reverse());
  }, [layers]);

  const handleReorder = (newOrder: Layer[]) => {
    setItems(newOrder);
    // Push to global state immediately for real-time canvas updates.
    // We un-reverse it since the canvas expects bottom layers first.
    state.updateProjectDirect(p => ({ ...p, layers: newOrder.slice().reverse() }));
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {
      // Ignore vibration errors
    }
  };

  return (
    <div className="flex flex-col bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl overflow-hidden shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[color:var(--surface-1)] border-b border-[color:var(--border-subtle)]">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
          Layers ({layers.length})
        </h4>
        <div className="flex gap-1">
           <button onClick={state.groupSelection} disabled={state.selectedLayerIds.length < 2} className="px-2 py-0.5 text-[9px] bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] hover:text-primary-gold rounded disabled:opacity-30 uppercase font-bold border border-[color:var(--border-subtle)] shadow-sm transition-colors">Group</button>
           <button onClick={state.ungroupSelection} disabled={state.selectedLayerIds.length !== 1} className="px-2 py-0.5 text-[9px] bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] hover:text-primary-gold rounded disabled:opacity-30 uppercase font-bold border border-[color:var(--border-subtle)] shadow-sm transition-colors">Ungroup</button>
        </div>
      </div>

      {layers.length === 0 && (
        <div className="text-center py-8 text-xs text-[color:var(--text-tertiary)] italic">
          No layers yet — add elements to get started
        </div>
      )}

      {/* Card Body */}
      <div 
        className="space-y-1.5 max-h-[35vh] overflow-y-auto overflow-x-hidden scrollbar-thin p-2 w-full touch-pan-y"
        style={{ scrollbarGutter: 'stable', touchAction: 'pan-y' }} // CRITICAL: Reserves space for the vertical scrollbar so width never shifts!
      >
        {/* Reorder Group handles the real-time layout projection and animations */}
        <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-1.5 flex flex-col w-full pb-2">
          {items.map(layer => (
            <LayerNode 
              key={layer.id} 
              layer={layer} 
              state={state} 
              depth={0} 
              isTopLevel={true}
            />
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
