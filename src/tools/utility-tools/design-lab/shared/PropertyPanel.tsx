'use client';

// ==============================================================================
// DESIGNLAB — Property Panel
// Contextual property editors for the active layer
// ==============================================================================

import React, { useMemo } from 'react';
import { SlidersHorizontal, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import type { TextLayer, ImageLayer, ShapeLayer } from '../types';
import { DEFAULT_FILTERS, DEFAULT_IMAGE_BORDER } from '../types';
import { FILL_COLORS } from '../constants';
import { getDeviceCapability, clamp } from '../utils';

interface PropertyPanelProps {
  state: DesignLabState;
}

export default function PropertyPanel({ state }: PropertyPanelProps) {
  const layer = state.activeLayer;
  const { isDesktop } = useMemo(() => getDeviceCapability(), []);
  if (!layer) return null;

  const update = (updates: any) => state.updateSelectedLayers(updates);

  return (
    <div className="space-y-3 p-3 bg-[color:var(--surface-2)] rounded-xl border border-[color:var(--border-subtle)] animate-in fade-in duration-200">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
        <SlidersHorizontal className="w-3 h-3" /> Properties
      </h4>



      {/* ── Text-specific ── */}
      {layer.type === 'text' && (() => {
        const tl = layer as TextLayer;
        return (
          <div className="space-y-3 pt-2 border-t border-[color:var(--border-subtle)]">
            {/* Font size */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Font Size</label>
                <div className="flex items-center">
                  <input 
                    type="number" 
                    min="8" max="2000" 
                    value={tl.fontSize} 
                    onChange={e => update({ fontSize: parseInt(e.target.value) || 8 })}
                    className="w-12 text-right bg-transparent border-b border-transparent focus:border-[color:var(--border-subtle)] text-[9px] font-mono text-primary-gold focus:outline-none transition-colors"
                  />
                  <span className="text-[9px] font-mono text-primary-gold">px</span>
                </div>
              </div>
              <input type="range" min="8" max="2000" value={tl.fontSize} onChange={e => update({ fontSize: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
            </div>

            {/* Stroke width */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Stroke Width</label>
                <span className="text-[9px] font-mono text-primary-gold">{tl.strokeWidth}px</span>
              </div>
              <input type="range" min="0" max="20" value={tl.strokeWidth} onChange={e => update({ strokeWidth: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
            </div>

            {/* Line height & letter spacing (desktop) */}
            {isDesktop && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Line Height</label>
                    <span className="text-[9px] font-mono text-primary-gold">{tl.lineHeight.toFixed(1)}</span>
                  </div>
                  <input type="range" min="8" max="30" value={Math.round(tl.lineHeight * 10)} onChange={e => update({ lineHeight: parseInt(e.target.value) / 10 })} className="w-full accent-primary-gold" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Spacing</label>
                    <span className="text-[9px] font-mono text-primary-gold">{tl.letterSpacing}px</span>
                  </div>
                  <input type="range" min="0" max="20" value={tl.letterSpacing} onChange={e => update({ letterSpacing: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Image-specific ── */}
      {layer.type === 'image' && (() => {
        const il = layer as ImageLayer;
        const border = il.border ?? { ...DEFAULT_IMAGE_BORDER };
        const updateBorder = (updates: Partial<typeof border>) =>
          update({ border: { ...border, ...updates } });

        const BORDER_PRESET_COLORS = [
          '#FFFFFF', '#000000', '#ef4444', '#f97316', '#eab308',
          '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
        ];

        return (
          <div className="space-y-4 pt-2 border-t border-[color:var(--border-subtle)]">
            {/* ── Filters (desktop only) ── */}
            {isDesktop && (
              <div className="space-y-3">
                <h5 className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">Image Filters</h5>
                {(['brightness', 'contrast', 'saturation'] as const).map(key => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] capitalize">{key}</label>
                      <span className="text-[9px] font-mono text-primary-gold">{il.filters[key]}%</span>
                    </div>
                    <input
                      type="range" min="0" max="200"
                      value={il.filters[key]}
                      onChange={e => update({ filters: { ...il.filters, [key]: parseInt(e.target.value) } })}
                      className="w-full accent-primary-gold"
                    />
                  </div>
                ))}
                <button
                  onClick={() => update({ filters: { ...DEFAULT_FILTERS } })}
                  className="text-[10px] font-bold text-primary-gold hover:underline"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* ── Border Controls ── */}
            <div className="space-y-3 pt-2 border-t border-[color:var(--border-subtle)]">
              {/* Solid Border Toggle + Header */}
              <div className="flex items-center justify-between">
                <h5 className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">Object Border</h5>
                <button
                  onClick={() => updateBorder({ enabled: !border.enabled })}
                  className={`relative w-8 h-[18px] rounded-full transition-colors ${
                    border.enabled ? 'bg-primary-gold' : 'bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]'
                  }`}
                >
                  <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${
                    border.enabled ? 'left-[15px] bg-black' : 'left-[2px] bg-[color:var(--text-tertiary)]'
                  }`} />
                </button>
              </div>

              {border.enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Border Color */}
                  <div>
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1.5 block">Border Color</label>
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-10 gap-1 flex-1">
                        {BORDER_PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateBorder({ color: c })}
                            className={`w-full aspect-square rounded-full border transition-transform hover:scale-110 ${
                              border.color === c
                                ? 'border-primary-gold ring-1 ring-primary-gold/30 scale-110'
                                : 'border-black/10'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="relative rounded-md overflow-hidden w-6 h-6 border border-[color:var(--border-subtle)] shrink-0 shadow-sm">
                        <input
                          type="color"
                          value={border.color}
                          onChange={e => updateBorder({ color: e.target.value })}
                          className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Border Thickness */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Thickness</label>
                      <span className="text-[9px] font-mono text-primary-gold">{border.thickness}px</span>
                    </div>
                    <input
                      type="range" min="0" max="40"
                      value={border.thickness}
                      onChange={e => updateBorder({ thickness: parseInt(e.target.value) })}
                      className="w-full accent-primary-gold"
                    />
                  </div>

                  {/* ── Glow Sub-section ── */}
                  <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">Glow Effect</label>
                      <button
                        onClick={() => updateBorder({ glowEnabled: !border.glowEnabled })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors ${
                          border.glowEnabled ? 'bg-purple-500' : 'bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]'
                        }`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${
                          border.glowEnabled ? 'left-[15px] bg-white' : 'left-[2px] bg-[color:var(--text-tertiary)]'
                        }`} />
                      </button>
                    </div>

                    {border.glowEnabled && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Glow Color */}
                        <div>
                          <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1.5 block">Glow Color</label>
                          <div className="flex items-center gap-2">
                            <div className="grid grid-cols-10 gap-1 flex-1">
                              {BORDER_PRESET_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => updateBorder({ glowColor: c })}
                                  className={`w-full aspect-square rounded-full border transition-transform hover:scale-110 ${
                                    border.glowColor === c
                                      ? 'border-purple-400 ring-1 ring-purple-400/30 scale-110'
                                      : 'border-black/10'
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            <div className="relative rounded-md overflow-hidden w-6 h-6 border border-[color:var(--border-subtle)] shrink-0 shadow-sm">
                              <input
                                type="color"
                                value={border.glowColor}
                                onChange={e => updateBorder({ glowColor: e.target.value })}
                                className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Glow Radius */}
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Glow Radius</label>
                            <span className="text-[9px] font-mono text-purple-400">{border.glowRadius}px</span>
                          </div>
                          <input
                            type="range" min="1" max="60"
                            value={border.glowRadius}
                            onChange={e => updateBorder({ glowRadius: parseInt(e.target.value) })}
                            className="w-full accent-purple-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reset Border */}
                  <button
                    onClick={() => update({ border: { ...DEFAULT_IMAGE_BORDER } })}
                    className="text-[10px] font-bold text-red-400 hover:underline"
                  >
                    Reset Border
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Shape-specific ── */}
      {layer.type === 'shape' && (() => {
        const sl = layer as ShapeLayer;
        return (
          <div className="space-y-3 pt-2 border-t border-[color:var(--border-subtle)]">
            {/* Fill */}
            <div>
              <h5 className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] mb-1.5">Fill</h5>
              <div className="flex gap-1 mb-2">
                {(['solid', 'gradient', 'none'] as const).map(ft => (
                  <button
                    key={ft}
                    onClick={() => update({ fillType: ft })}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${sl.fillType === ft ? 'bg-primary-gold text-black' : 'bg-[color:var(--surface-1)] text-[color:var(--text-tertiary)]'}`}
                  >
                    {ft}
                  </button>
                ))}
              </div>
              {sl.fillType === 'solid' && (
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-10 gap-1 flex-1">
                    {FILL_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => update({ fill: c })}
                        className={`w-full aspect-square rounded-full border ${sl.fill === c ? 'border-primary-gold ring-1 ring-primary-gold/30 scale-110' : 'border-black/10'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="relative rounded-md overflow-hidden w-6 h-6 border border-[color:var(--border-subtle)] shrink-0 shadow-sm">
                    <input
                      type="color"
                      value={sl.fill}
                      onChange={e => update({ fill: e.target.value })}
                      className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>
              )}

              {sl.fillType === 'gradient' && (
                <div className="space-y-3 mt-2">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Color 1</label>
                      <div className="relative rounded overflow-hidden w-full h-8 border border-[color:var(--border-subtle)]">
                        <input type="color" value={sl.gradientColors?.[0] ?? '#FF512F'} onChange={e => update({ gradientColors: [e.target.value, sl.gradientColors?.[1] ?? '#DD2476'] })} className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer bg-transparent border-0" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Color 2</label>
                      <div className="relative rounded overflow-hidden w-full h-8 border border-[color:var(--border-subtle)]">
                        <input type="color" value={sl.gradientColors?.[1] ?? '#DD2476'} onChange={e => update({ gradientColors: [sl.gradientColors?.[0] ?? '#FF512F', e.target.value] })} className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer bg-transparent border-0" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Angle</label>
                      <span className="text-[9px] font-mono text-primary-gold">{sl.gradientAngle ?? 135}°</span>
                    </div>
                    <input type="range" min="0" max="360" value={sl.gradientAngle ?? 135} onChange={e => update({ gradientAngle: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Dominant Color</label>
                      <span className="text-[9px] font-mono text-primary-gold">{sl.gradientStop ?? 50}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={sl.gradientStop ?? 50} onChange={e => update({ gradientStop: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
                  </div>
                </div>
              )}
            </div>

            {/* Stroke */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Stroke</label>
                <div className="relative rounded overflow-hidden w-5 h-5 border border-[color:var(--border-subtle)]">
                  <input type="color" value={sl.stroke} onChange={e => update({ stroke: e.target.value })} className="absolute inset-[-6px] w-8 h-8 cursor-pointer bg-transparent border-0" />
                </div>
              </div>
              <input type="range" min="0" max="20" value={sl.strokeWidth} onChange={e => update({ strokeWidth: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
            </div>

            {/* Corner radius for rectangle */}
            {sl.shapeKind === 'rectangle' && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Corner Radius</label>
                  <span className="text-[9px] font-mono text-primary-gold">{sl.cornerRadius}px</span>
                </div>
                <input type="range" min="0" max="100" value={sl.cornerRadius} onChange={e => update({ cornerRadius: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
              </div>
            )}

            {/* Star points */}
            {sl.shapeKind === 'star' && isDesktop && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Points</label>
                    <span className="text-[9px] font-mono text-primary-gold">{sl.starPoints}</span>
                  </div>
                  <input type="range" min="3" max="12" value={sl.starPoints} onChange={e => update({ starPoints: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Inner Radius</label>
                    <span className="text-[9px] font-mono text-primary-gold">{Math.round(sl.starInnerRadius * 100)}%</span>
                  </div>
                  <input type="range" min="10" max="90" value={Math.round(sl.starInnerRadius * 100)} onChange={e => update({ starInnerRadius: parseInt(e.target.value) / 100 })} className="w-full accent-primary-gold" />
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
