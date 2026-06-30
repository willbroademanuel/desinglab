'use client';

// ==============================================================================
// DESIGNLAB — Universal Edit Panel
// Universal tools for any layer: Blur, Shadow, Transform
// ==============================================================================

import React from 'react';
import { X, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';

interface UniversalEditPanelProps {
  state: DesignLabState;
  onClose: () => void;
  inline?: boolean;
  activeSlider?: string | null;
  setActiveSlider?: (id: string | null) => void;
}

export default function UniversalEditPanel({ state, onClose, inline, activeSlider, setActiveSlider }: UniversalEditPanelProps) {
  const layer = state.activeLayer;

  if (!layer) return null;

  const update = (updates: Partial<any>) => {
    state.updateSelectedLayers(updates);
  };

  const handleShadowChange = (updates: Partial<any>) => {
    const currentShadow = layer.shadow || { x: 5, y: 5, blur: 10, color: 'rgba(0,0,0,0.5)' };
    const newShadow = { ...currentShadow, ...updates };
    update({ shadow: newShadow });
  };

  const toggleShadow = () => {
    if (layer.shadow) {
      update({ shadow: null });
    } else {
      update({ shadow: { x: 5, y: 5, blur: 10, color: 'rgba(0,0,0,0.5)' } });
    }
  };

  const containerClass = inline
    ? "flex flex-col space-y-4"
    : "absolute inset-0 bg-[color:var(--surface-1)] z-50 flex flex-col";

  return (
    <div className={containerClass}>
      {!inline && (
        <div className="flex items-center justify-between p-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-primary)]">
            Universal Edits
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-1)] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`${inline ? 'p-0 space-y-4' : 'flex-1 overflow-y-auto p-4 space-y-6'}`}>
        
        {/* Blur */}
        <div className={`space-y-2 transition-opacity duration-300 ${activeSlider && activeSlider !== 'blur' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[color:var(--text-secondary)]">BLUR</label>
            <span className="text-[9px] font-mono text-primary-gold">{layer.blur || 0}px</span>
          </div>
          <input
            type="range"
            min="0" max="100"
            value={layer.blur || 0}
            onChange={e => update({ blur: parseInt(e.target.value) })}
            onPointerDown={() => setActiveSlider?.('blur')}
            className="w-full accent-primary-gold relative z-10"
          />
        </div>

        <div className={`w-full h-px bg-[color:var(--border-subtle)] transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />

        {/* Drop Shadow */}
        <div className={`space-y-3 transition-opacity duration-300 ${activeSlider && activeSlider !== 'shadow_x' && activeSlider !== 'shadow_y' && activeSlider !== 'shadow_blur' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[color:var(--text-secondary)]">DROP SHADOW</label>
            <button
              onClick={() => { toggleShadow(); onClose(); }}
              className={`w-8 h-4 rounded-full relative transition-colors ${layer.shadow ? 'bg-primary-gold' : 'bg-[color:var(--border-subtle)]'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${layer.shadow ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {layer.shadow && (
            <div className="bg-[color:var(--surface-2)] p-3 rounded-lg border border-[color:var(--border-subtle)] space-y-3 relative z-10">
              <div className={`space-y-1 transition-opacity duration-300 ${activeSlider && activeSlider !== 'shadow_x' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex justify-between">
                  <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">X Offset</label>
                  <span className="text-[9px] font-mono">{layer.shadow.x}</span>
                </div>
                <input type="range" min="-50" max="50" value={layer.shadow.x} onChange={e => handleShadowChange({ x: parseInt(e.target.value) })} onPointerDown={() => setActiveSlider?.('shadow_x')} className="w-full accent-primary-gold h-1 relative z-10" />
              </div>
              <div className={`space-y-1 transition-opacity duration-300 ${activeSlider && activeSlider !== 'shadow_y' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex justify-between">
                  <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Y Offset</label>
                  <span className="text-[9px] font-mono">{layer.shadow.y}</span>
                </div>
                <input type="range" min="-50" max="50" value={layer.shadow.y} onChange={e => handleShadowChange({ y: parseInt(e.target.value) })} onPointerDown={() => setActiveSlider?.('shadow_y')} className="w-full accent-primary-gold h-1 relative z-10" />
              </div>
              <div className={`space-y-1 transition-opacity duration-300 ${activeSlider && activeSlider !== 'shadow_blur' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex justify-between">
                  <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Blur</label>
                  <span className="text-[9px] font-mono">{layer.shadow.blur}</span>
                </div>
                <input type="range" min="0" max="100" value={layer.shadow.blur} onChange={e => handleShadowChange({ blur: parseInt(e.target.value) })} onPointerDown={() => setActiveSlider?.('shadow_blur')} className="w-full accent-primary-gold h-1 relative z-10" />
              </div>
              <div className={`flex justify-between items-center pt-1 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Color</label>
                <input type="color" value={layer.shadow.color.substring(0, 7)} onChange={e => { handleShadowChange({ color: e.target.value }); onClose(); }} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
              </div>
            </div>
          )}
        </div>

        <div className={`w-full h-px bg-[color:var(--border-subtle)] transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />

        {/* Transform */}
        <div className={`space-y-3 transition-opacity duration-300 ${activeSlider && activeSlider !== 'rotation' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <label className="text-[10px] font-bold text-[color:var(--text-secondary)]">TRANSFORM</label>
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Rotation</label>
              <span className="text-[9px] font-mono text-primary-gold">{layer.rotation}°</span>
            </div>
            <input type="range" min="0" max="360" value={layer.rotation} onChange={e => update({ rotation: parseInt(e.target.value) })} onPointerDown={() => setActiveSlider?.('rotation')} className="w-full accent-primary-gold relative z-10" />
          </div>
          
          <div className={`flex gap-1 pt-2 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <button onClick={() => { update({ rotation: (layer.rotation + 90) % 360 }); onClose(); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[color:var(--surface-2)] rounded-lg text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] text-[10px] font-bold transition-colors border border-[color:var(--border-subtle)]" title="Rotate 90°">
              <RotateCw className="w-3 h-3" /> 90°
            </button>
            <button onClick={() => { update({ flipH: !layer.flipH }); onClose(); }} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors border ${layer.flipH ? 'bg-primary-gold/10 border-primary-gold text-primary-gold' : 'bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`} title="Flip Horizontal">
              <FlipHorizontal className="w-3 h-3" /> Flip H
            </button>
            <button onClick={() => { update({ flipV: !layer.flipV }); onClose(); }} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors border ${layer.flipV ? 'bg-primary-gold/10 border-primary-gold text-primary-gold' : 'bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`} title="Flip Vertical">
              <FlipVertical className="w-3 h-3" /> Flip V
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
