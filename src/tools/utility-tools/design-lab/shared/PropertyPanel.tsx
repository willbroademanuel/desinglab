'use client';

// ==============================================================================
// DESIGNLAB — Property Panel (Enterprise Edition)
// Contextual property editors for the active layer.
// Text layers now expose: fill type, gradient, curve, neon glow, background box,
// text transform, text decoration, font weight, and padding controls.
// ==============================================================================

import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCw, FlipHorizontal, FlipVertical, ChevronDown, ChevronRight } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import type { TextLayer, ImageLayer, ShapeLayer } from '../types';
import { DEFAULT_FILTERS, DEFAULT_IMAGE_BORDER, DEFAULT_TEXT_BACKGROUND_BOX, DEFAULT_TEXT_NEON_GLOW } from '../types';
import { FILL_COLORS, FONT_WEIGHT_LABELS } from '../constants';
import { getDeviceCapability, clamp } from '../utils';

interface PropertyPanelProps {
  state: DesignLabState;
}

// ── Small collapsible section wrapper ──
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full group"
      >
        <h5 className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] group-hover:text-[color:var(--text-secondary)] transition-colors">
          {title}
        </h5>
        {open
          ? <ChevronDown className="w-3 h-3 text-[color:var(--text-tertiary)]" />
          : <ChevronRight className="w-3 h-3 text-[color:var(--text-tertiary)]" />
        }
      </button>
      {open && <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">{children}</div>}
    </div>
  );
}

// ── Labeled slider row ──
function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">{label}</label>
        <span className="text-[9px] font-mono text-primary-gold">{typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary-gold"
      />
    </div>
  );
}

// ── Color swatch + color picker row ──
function ColorRow({ label, value, presets, onChange }: {
  label: string; value: string;
  presets?: string[];
  onChange: (c: string) => void;
}) {
  const swatches = presets ?? FILL_COLORS;
  return (
    <div>
      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-10 gap-1 flex-1">
          {swatches.slice(0, 10).map(c => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`w-full aspect-square rounded-full border transition-transform hover:scale-110 ${
                value === c ? 'border-primary-gold ring-1 ring-primary-gold/30 scale-110' : 'border-black/10'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="relative rounded-md overflow-hidden w-6 h-6 border border-[color:var(--border-subtle)] shrink-0 shadow-sm">
          <input
            type="color" value={value.substring(0, 7)}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
          />
        </div>
      </div>
    </div>
  );
}

// ── Toggle switch ──
function Toggle({ label, checked, onChange, accentClass = 'bg-primary-gold' }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; accentClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          checked ? accentClass : 'bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]'
        }`}
      >
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${
          checked ? 'left-[15px] bg-black' : 'left-[2px] bg-[color:var(--text-tertiary)]'
        }`} />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

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
        const fontWeight = tl.fontWeight ?? (tl.isBold ? 700 : 400);

        return (
          <div className="space-y-1">

            {/* ── Typography ── */}
            <Section title="Typography">
              {/* Font size */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Font Size</label>
                  <div className="flex items-center">
                    <input
                      type="number" min="8" max="2000"
                      value={tl.fontSize}
                      onChange={e => update({ fontSize: parseInt(e.target.value) || 8 })}
                      className="w-12 text-right bg-transparent border-b border-transparent focus:border-[color:var(--border-subtle)] text-[9px] font-mono text-primary-gold focus:outline-none transition-colors"
                    />
                    <span className="text-[9px] font-mono text-primary-gold">px</span>
                  </div>
                </div>
                <input type="range" min="8" max="2000" value={tl.fontSize} onChange={e => update({ fontSize: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
              </div>

              {/* Font Weight picker */}
              {isDesktop && (() => {
                const { FONT_LIST } = require('../constants');
                const entry = FONT_LIST.find((f: any) => f.name === tl.fontFamily);
                const weights: number[] = entry?.weights ?? [400, 700];
                if (weights.length <= 1) return null;
                return (
                  <div>
                    <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1 block">Weight</label>
                    <div className="flex flex-wrap gap-1">
                      {weights.map(w => (
                        <button
                          key={w}
                          onClick={() => update({ fontWeight: w, isBold: w >= 700 })}
                          className={`px-2 py-0.5 rounded text-[10px] transition-all border ${
                            fontWeight === w
                              ? 'bg-primary-gold text-black border-primary-gold'
                              : 'bg-[color:var(--surface-1)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] hover:border-primary-gold'
                          }`}
                          style={{ fontWeight: w, fontFamily: `"${tl.fontFamily}", sans-serif` }}
                          title={FONT_WEIGHT_LABELS[w]}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Text align, bold, italic (quick access) */}
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map(align => (
                  <button
                    key={align}
                    onClick={() => update({ textAlign: align })}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all border ${
                      tl.textAlign === align ? 'bg-primary-gold text-black border-primary-gold' : 'bg-[color:var(--surface-1)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)]'
                    }`}
                    title={`Align ${align}`}
                  >
                    {align === 'left' ? '⬅' : align === 'center' ? '⬛' : '➡'}
                  </button>
                ))}
              </div>

              {/* Text transform */}
              <div>
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1 block">Transform</label>
                <div className="flex gap-1">
                  {(['none', 'uppercase', 'lowercase', 'capitalize'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => update({ textTransform: t })}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md border transition-all ${
                        (tl.textTransform ?? 'none') === t ? 'bg-primary-gold text-black border-primary-gold' : 'bg-[color:var(--surface-1)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)]'
                      }`}
                      title={t}
                    >
                      {t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : 'Ab'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text decoration */}
              <div>
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1 block">Decoration</label>
                <div className="flex gap-1">
                  {(['none', 'underline', 'line-through'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => update({ textDecoration: d })}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md border transition-all ${
                        (tl.textDecoration ?? 'none') === d ? 'bg-primary-gold text-black border-primary-gold' : 'bg-[color:var(--surface-1)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)]'
                      }`}
                      title={d}
                      style={{ textDecoration: d !== 'none' ? d : undefined }}
                    >
                      {d === 'none' ? 'None' : d === 'underline' ? 'U' : 'S̶'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line height & letter spacing */}
              {isDesktop && (
                <div className="grid grid-cols-2 gap-2">
                  <SliderRow label="Line Height" value={tl.lineHeight} min={0.8} max={3} step={0.1} onChange={v => update({ lineHeight: v })} />
                  <SliderRow label="Spacing" value={tl.letterSpacing} min={-20} max={50} unit="px" onChange={v => update({ letterSpacing: Math.round(v) })} />
                </div>
              )}

              {/* Padding */}
              {isDesktop && (
                <SliderRow label="Padding" value={tl.padding ?? 12} min={0} max={60} unit="px" onChange={v => update({ padding: Math.round(v) })} />
              )}
            </Section>

            {/* ── Stroke ── */}
            <Section title="Stroke" defaultOpen={tl.strokeWidth > 0}>
              <SliderRow label="Stroke Width" value={tl.strokeWidth} min={0} max={30} unit="px" onChange={v => update({ strokeWidth: Math.round(v) })} />
              {tl.strokeWidth > 0 && (
                <ColorRow label="Stroke Color" value={tl.strokeColor} onChange={c => update({ strokeColor: c })} />
              )}
            </Section>

            {/* ── Fill ── */}
            <Section title="Fill">
              {/* Fill type toggle */}
              <div className="flex gap-1">
                {(['solid', 'gradient', 'rainbow'] as const).map(ft => (
                  <button
                    key={ft}
                    onClick={() => update({ fillType: ft })}
                    className={`flex-1 py-1.5 text-[10px] font-bold capitalize rounded-md transition-all border ${
                      (tl.fillType ?? 'solid') === ft ? 'bg-primary-gold text-black border-primary-gold' : 'bg-[color:var(--surface-1)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)]'
                    }`}
                  >
                    {ft === 'rainbow' ? '🌈' : ft.charAt(0).toUpperCase() + ft.slice(1)}
                  </button>
                ))}
              </div>

              {/* Solid fill color */}
              {(!tl.fillType || tl.fillType === 'solid') && (
                <ColorRow label="Color" value={tl.color} onChange={c => update({ color: c })} />
              )}

              {/* Gradient fill */}
              {tl.fillType === 'gradient' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1 block">Color 1</label>
                      <div className="relative rounded overflow-hidden w-full h-8 border border-[color:var(--border-subtle)]">
                        <input type="color" value={tl.gradientColors?.[0] ?? '#FF512F'} onChange={e => update({ gradientColors: [e.target.value, tl.gradientColors?.[1] ?? '#DD2476'] })} className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer bg-transparent border-0" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)] mb-1 block">Color 2</label>
                      <div className="relative rounded overflow-hidden w-full h-8 border border-[color:var(--border-subtle)]">
                        <input type="color" value={tl.gradientColors?.[1] ?? '#DD2476'} onChange={e => update({ gradientColors: [tl.gradientColors?.[0] ?? '#FF512F', e.target.value] })} className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer bg-transparent border-0" />
                      </div>
                    </div>
                  </div>
                  <SliderRow label="Angle" value={tl.gradientAngle ?? 135} min={0} max={360} unit="°" onChange={v => update({ gradientAngle: Math.round(v) })} />
                </div>
              )}
            </Section>

            {/* ── Curve ── */}
            <Section title="Curve" defaultOpen={(tl.curveAmount ?? 0) !== 0}>
              <SliderRow
                label="Arc Amount"
                value={tl.curveAmount ?? 0}
                min={-180} max={180} unit="°"
                onChange={v => update({ curveAmount: Math.round(v) })}
              />
              {(tl.curveAmount ?? 0) !== 0 && (
                <p className="text-[9px] text-amber-400 flex items-center gap-1">
                  <span>⚠</span> Inline editing disabled for curved text
                </p>
              )}
              {(tl.curveAmount ?? 0) !== 0 && (
                <button
                  onClick={() => update({ curveAmount: 0 })}
                  className="text-[10px] font-bold text-[color:var(--text-tertiary)] hover:text-primary-gold transition-colors"
                >
                  Remove Curve
                </button>
              )}
            </Section>

            {/* ── Text Effects ── */}
            <Section title="Text Effects" defaultOpen={!!tl.neonGlow?.enabled || !!tl.backgroundBox?.enabled}>

              {/* Neon Glow */}
              <Toggle
                label="Neon Glow"
                checked={!!tl.neonGlow?.enabled}
                accentClass="bg-cyan-500"
                onChange={v => {
                  if (v) {
                    update({ neonGlow: { ...(tl.neonGlow ?? DEFAULT_TEXT_NEON_GLOW), enabled: true } });
                  } else {
                    update({ neonGlow: null });
                  }
                }}
              />
              {tl.neonGlow?.enabled && (
                <div className="space-y-2 pl-2 border-l-2 border-cyan-500/30 animate-in fade-in duration-150">
                  <ColorRow label="Glow Color" value={tl.neonGlow.color} onChange={c => update({ neonGlow: { ...tl.neonGlow!, color: c } })} />
                  <SliderRow label="Intensity" value={tl.neonGlow.intensity} min={1} max={30} onChange={v => update({ neonGlow: { ...tl.neonGlow!, intensity: Math.round(v) } })} />
                </div>
              )}

              {/* Background Box */}
              <Toggle
                label="Background Box"
                checked={!!tl.backgroundBox?.enabled}
                accentClass="bg-violet-500"
                onChange={v => {
                  if (v) {
                    update({ backgroundBox: { ...(tl.backgroundBox ?? DEFAULT_TEXT_BACKGROUND_BOX), enabled: true } });
                  } else {
                    update({ backgroundBox: null });
                  }
                }}
              />
              {tl.backgroundBox?.enabled && (
                <div className="space-y-2 pl-2 border-l-2 border-violet-500/30 animate-in fade-in duration-150">
                  <ColorRow
                    label="Box Color"
                    value={tl.backgroundBox.color.substring(0, 7)}
                    onChange={c => update({ backgroundBox: { ...tl.backgroundBox!, color: c } })}
                  />
                  <SliderRow label="Padding" value={tl.backgroundBox.padding} min={0} max={40} unit="px" onChange={v => update({ backgroundBox: { ...tl.backgroundBox!, padding: Math.round(v) } })} />
                  <SliderRow label="Corner Radius" value={tl.backgroundBox.cornerRadius} min={0} max={50} unit="px" onChange={v => update({ backgroundBox: { ...tl.backgroundBox!, cornerRadius: Math.round(v) } })} />
                </div>
              )}
            </Section>

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
                <button onClick={() => update({ filters: { ...DEFAULT_FILTERS } })} className="text-[10px] font-bold text-primary-gold hover:underline">
                  Reset Filters
                </button>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-[color:var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <h5 className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">Object Border</h5>
                <button
                  onClick={() => updateBorder({ enabled: !border.enabled })}
                  className={`relative w-8 h-[18px] rounded-full transition-colors ${border.enabled ? 'bg-primary-gold' : 'bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]'}`}
                >
                  <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${border.enabled ? 'left-[15px] bg-black' : 'left-[2px] bg-[color:var(--text-tertiary)]'}`} />
                </button>
              </div>

              {border.enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <ColorRow label="Border Color" value={border.color} presets={BORDER_PRESET_COLORS} onChange={c => updateBorder({ color: c })} />
                  <SliderRow label="Thickness" value={border.thickness} min={0} max={40} unit="px" onChange={v => updateBorder({ thickness: Math.round(v) })} />

                  <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">Glow Effect</label>
                      <button
                        onClick={() => updateBorder({ glowEnabled: !border.glowEnabled })}
                        className={`relative w-8 h-[18px] rounded-full transition-colors ${border.glowEnabled ? 'bg-purple-500' : 'bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]'}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${border.glowEnabled ? 'left-[15px] bg-white' : 'left-[2px] bg-[color:var(--text-tertiary)]'}`} />
                      </button>
                    </div>

                    {border.glowEnabled && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <ColorRow label="Glow Color" value={border.glowColor} presets={BORDER_PRESET_COLORS} onChange={c => updateBorder({ glowColor: c })} />
                        <SliderRow label="Glow Radius" value={border.glowRadius} min={1} max={60} unit="px" onChange={v => updateBorder({ glowRadius: Math.round(v) })} />
                      </div>
                    )}
                  </div>

                  <button onClick={() => update({ border: { ...DEFAULT_IMAGE_BORDER } })} className="text-[10px] font-bold text-red-400 hover:underline">
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
                    <input type="color" value={sl.fill} onChange={e => update({ fill: e.target.value })} className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0" />
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
                  <SliderRow label="Angle" value={sl.gradientAngle ?? 135} min={0} max={360} unit="°" onChange={v => update({ gradientAngle: Math.round(v) })} />
                  <SliderRow label="Dominant Color" value={sl.gradientStop ?? 50} min={0} max={100} unit="%" onChange={v => update({ gradientStop: Math.round(v) })} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">Stroke</label>
                <div className="relative rounded overflow-hidden w-5 h-5 border border-[color:var(--border-subtle)]">
                  <input type="color" value={sl.stroke} onChange={e => update({ stroke: e.target.value })} className="absolute inset-[-6px] w-8 h-8 cursor-pointer bg-transparent border-0" />
                </div>
              </div>
              <input type="range" min="0" max="20" value={sl.strokeWidth} onChange={e => update({ strokeWidth: parseInt(e.target.value) })} className="w-full accent-primary-gold" />
            </div>

            {sl.shapeKind === 'rectangle' && (
              <SliderRow label="Corner Radius" value={sl.cornerRadius} min={0} max={100} unit="px" onChange={v => update({ cornerRadius: Math.round(v) })} />
            )}

            {sl.shapeKind === 'star' && isDesktop && (
              <div className="space-y-2">
                <SliderRow label="Points" value={sl.starPoints} min={3} max={12} onChange={v => update({ starPoints: Math.round(v) })} />
                <SliderRow label="Inner Radius" value={Math.round(sl.starInnerRadius * 100)} min={10} max={90} unit="%" onChange={v => update({ starInnerRadius: v / 100 })} />
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
