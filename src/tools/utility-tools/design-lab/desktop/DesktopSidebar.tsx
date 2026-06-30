'use client';

import React, { useState, useMemo } from 'react';
import {
  Type, Image as ImageIcon, Square, Circle, Triangle, Star,
  Minus, ArrowRight, Heart, Hexagon,
  Palette, Library, Layers
} from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import type { ShapeKind, SidebarTab } from '../types';
import { ImageUploader } from '@tools/shared/components/ImageUploader';
import { FONT_LIST, BG_SOLID_COLORS, BG_GRADIENTS } from '../constants';
import { loadGoogleFont } from '../utils';
import PropertyPanel from '../shared/PropertyPanel';
import FontPicker from '../shared/FontPicker';
import LayerPanel from '../shared/LayerPanel';
import AssetBrowser from '../shared/AssetBrowser';
import UniversalEditPanel from '../shared/UniversalEditPanel';
import ImageEditPanel from '../shared/ImageEditPanel';
import { GlobalCropModal } from '@tools/shared/components/GlobalCropModal';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface DesktopSidebarProps {
  state: DesignLabState;
  onBgRemoval: () => void;
  isUniversalEditOpen?: boolean;
  setIsUniversalEditOpen?: (open: boolean) => void;
}

const SHAPES: { kind: ShapeKind; icon: any; label: string }[] = [
  { kind: 'rectangle', icon: Square, label: 'Rectangle' },
  { kind: 'circle', icon: Circle, label: 'Circle' },
  { kind: 'triangle', icon: Triangle, label: 'Triangle' },
  { kind: 'star', icon: Star, label: 'Star' },
  { kind: 'line', icon: Minus, label: 'Line' },
  { kind: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { kind: 'heart', icon: Heart, label: 'Heart' },
  { kind: 'hexagon', icon: Hexagon, label: 'Hexagon' },
];

export default function DesktopSidebar({ state, onBgRemoval, isUniversalEditOpen, setIsUniversalEditOpen }: DesktopSidebarProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SidebarTab | null>('elements');
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  const filteredFonts = useMemo(() => {
    if (!fontSearch) return FONT_LIST;
    const q = fontSearch.toLowerCase();
    return FONT_LIST.filter(f => f.name.toLowerCase().includes(q));
  }, [fontSearch]);

  const TABS: { id: SidebarTab; icon: any; label: string }[] = [
    { id: 'elements', icon: Square, label: t('designLab.elements') || 'Elements' },
    { id: 'text', icon: Type, label: t('designLab.text') || 'Text' },
    { id: 'assets', icon: Library, label: t('designLab.assets') || 'Assets' },
    { id: 'background', icon: Palette, label: t('designLab.bg') || 'BG' },
    { id: 'layers', icon: Layers, label: t('designLab.layers') || 'Layers' },
  ];

  // Auto-open Image Edit panel when an image is selected
  React.useEffect(() => {
    if (state.activeLayer?.type === 'image') {
      setIsImageEditOpen(true);
      setIsUniversalEditOpen?.(false);
    } else {
      setIsImageEditOpen(false);
    }
  }, [state.activeLayer?.id, setIsUniversalEditOpen]);

  // Turn off Image Edit panel if user explicitly opens the Universal Edit tool
  React.useEffect(() => {
    if (isUniversalEditOpen) {
      setIsImageEditOpen(false);
    }
  }, [isUniversalEditOpen]);

  const handleImageUpload = (file: File) => {
    setPendingUploadFile(file);
  };

  return (
    <div className="w-[320px] shrink-0 bg-[color:var(--surface-1)] rounded-lg border border-[color:var(--border-subtle)] flex flex-col h-full overflow-hidden relative">
      
      {pendingUploadFile && (
        <GlobalCropModal
          file={pendingUploadFile}
          onConfirm={(croppedFile: File) => {
            state.addImageLayer(croppedFile);
            setPendingUploadFile(null);
          }}
          onCancel={() => setPendingUploadFile(null)}
        />
      )}
      {isUniversalEditOpen && (
        <UniversalEditPanel state={state} onClose={() => setIsUniversalEditOpen?.(false)} />
      )}

      {isImageEditOpen && (
        <ImageEditPanel state={state} onClose={() => setIsImageEditOpen(false)} onBgRemoval={onBgRemoval} />
      )}

      {/* Tab selector */}
      <div className="flex p-1 mx-3 mt-3 bg-[color:var(--surface-2)] rounded-lg border border-[color:var(--border-subtle)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
            className={`flex-1 py-2 flex justify-center items-center rounded-md transition-all ${
              (activeTab === t.id && !isImageEditOpen) || (!activeTab && t.id === 'elements' && !isImageEditOpen)
                ? 'bg-[color:var(--surface-1)] text-primary-gold shadow-sm'
                : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden p-3 space-y-4">

        {/* ── ELEMENTS TAB ── */}
        {(activeTab === 'elements' || !activeTab) && (
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.shapes') || 'Shapes'}</h4>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map(s => (
                  <button
                    key={s.kind}
                    onClick={() => state.addShapeLayer(s.kind)}
                    className="flex flex-col items-center gap-1 py-3 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all"
                  >
                    <s.icon className="w-5 h-5 text-primary-gold" />
                    <span className="text-[10px] font-semibold text-[color:var(--text-secondary)]">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick add */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.quickAdd') || 'Quick Add'}</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={state.addTextLayer} className="flex items-center justify-center gap-2 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all">
                  <Type className="w-4 h-4 text-primary-gold" />
                  <span className="text-xs font-semibold">{t('designLab.text') || 'Text'}</span>
                </button>
                <label className="flex items-center justify-center gap-2 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all cursor-pointer">
                  <ImageIcon className="w-4 h-4 text-primary-gold" />
                  <span className="text-xs font-semibold">{t('designLab.image') || 'Image'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </label>
              </div>
            </div>

            {state.activeLayer && <PropertyPanel state={state} />}
          </div>
        )}

        {/* ── TEXT TAB ── */}
        {activeTab === 'text' && (
          <div className="space-y-4">

            {/* Style preset quick-add buttons */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">Add Text</h4>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={state.addHeadingLayer}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all"
                >
                  <span className="text-base font-black text-[color:var(--text-primary)] leading-none">Heading</span>
                  <span className="text-[9px] text-[color:var(--text-tertiary)] uppercase tracking-wider">Montserrat · 800</span>
                </button>
                <button
                  onClick={state.addSubheadingLayer}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all"
                >
                  <span className="text-sm font-semibold text-[color:var(--text-primary)] leading-none">Subheading</span>
                  <span className="text-[9px] text-[color:var(--text-tertiary)] uppercase tracking-wider">Poppins · 600</span>
                </button>
                <button
                  onClick={state.addBodyTextLayer}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all"
                >
                  <span className="text-xs font-normal text-[color:var(--text-primary)] leading-none">Body text</span>
                  <span className="text-[9px] text-[color:var(--text-tertiary)] uppercase tracking-wider">Inter · 400</span>
                </button>
                <button
                  onClick={state.addCaptionLayer}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all"
                >
                  <span className="text-[10px] font-light tracking-widest text-[color:var(--text-primary)] leading-none uppercase">CAPTION</span>
                  <span className="text-[9px] text-[color:var(--text-tertiary)] uppercase tracking-wider">Inter · 300</span>
                </button>
              </div>
              <button
                onClick={state.addTextLayer}
                className="w-full mt-1.5 py-2.5 bg-[color:var(--surface-2)] border border-dashed border-[color:var(--border-subtle)] hover:border-primary-gold text-[color:var(--text-secondary)] font-semibold rounded-xl transition-all text-sm"
              >
                + Add Plain Text
              </button>
            </div>

            {/* Font picker — shown when a text layer is selected */}
            {state.activeLayer?.type === 'text' && (
              <>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">Font Family</h4>
                  <FontPicker
                    currentFont={(state.activeLayer as any).fontFamily || 'Inter'}
                    currentWeight={(state.activeLayer as any).fontWeight ?? 400}
                    onFontChange={(fontName) => state.updateLayer(state.activeLayer!.id, { fontFamily: fontName } as any)}
                    onWeightChange={(weight) => state.updateLayer(state.activeLayer!.id, { fontWeight: weight, isBold: weight >= 700 } as any)}
                    maxHeight={220}
                  />
                </div>
                <PropertyPanel state={state} />
              </>
            )}
          </div>
        )}

        {/* ── ASSETS TAB ── */}
        {activeTab === 'assets' && (
          <AssetBrowser state={state} />
        )}

        {/* ── BACKGROUND TAB ── */}
        {activeTab === 'background' && (
          <div className="space-y-4">
            <button
              onClick={() => state.updateProjectBg({ bgType: 'transparent' })}
              className={`w-full py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-xl border transition-all ${
                state.project.bgType === 'transparent'
                  ? 'bg-primary-gold/10 border-primary-gold text-primary-gold'
                  : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--text-tertiary)]'
              }`}
            >
              <svg className="w-4 h-4 rounded-sm border border-[color:var(--border-subtle)] opacity-80" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="8" height="8" fill="#d1d5db"/>
                <rect x="8" y="8" width="8" height="8" fill="#d1d5db"/>
                <rect y="8" width="8" height="8" fill="#ffffff"/>
                <rect x="8" width="8" height="8" fill="#ffffff"/>
              </svg>
              <span>{t('designLab.transparent') || 'Transparent'}</span>
            </button>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.solidColor') || 'Solid Color'}</h4>
              <div className="grid grid-cols-8 gap-2">
                {BG_SOLID_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => state.updateProjectBg({ bgType: 'solid', bgColor: c })}
                    className={`w-full aspect-square rounded-full border-2 transition-all hover:scale-110 ${state.project.bgType === 'solid' && state.project.bgColor === c ? 'border-primary-gold ring-2 ring-primary-gold/30 scale-110' : 'border-black/10'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3 p-3 bg-[color:var(--surface-2)] rounded-xl border border-[color:var(--border-subtle)]">
                <input
                  type="color"
                  value={state.project.bgColor}
                  onChange={e => state.updateProjectBg({ bgType: 'solid', bgColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={state.project.bgColor.toUpperCase()}
                  onChange={e => state.updateProjectBg({ bgType: 'solid', bgColor: e.target.value })}
                  className="flex-1 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] rounded-lg px-3 py-2 font-mono text-xs uppercase focus:border-primary-gold outline-none"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.gradient') || 'Gradient'}</h4>
              <div className="grid grid-cols-3 gap-2">
                {BG_GRADIENTS.map(g => (
                  <button
                    key={g.name}
                    onClick={() => state.updateProjectBg({ bgType: 'gradient', bgGradient: { c1: g.c1, c2: g.c2, angle: 135 } })}
                    className={`h-14 rounded-xl flex items-end p-2 transition-all hover:scale-105 active:scale-95 ${
                      state.project.bgType === 'gradient' && state.project.bgGradient.c1 === g.c1
                        ? 'ring-2 ring-primary-gold shadow-md'
                        : ''
                    }`}
                    style={{ background: `linear-gradient(135deg, ${g.c1}, ${g.c2})` }}
                  >
                    <span className="text-[9px] font-bold text-white drop-shadow-md bg-black/30 px-1.5 py-0.5 rounded-full">{g.name}</span>
                  </button>
                ))}
              </div>

              {state.project.bgType === 'gradient' && (
                <div className="mt-3 p-3 bg-[color:var(--surface-2)] rounded-xl border border-[color:var(--border-subtle)] space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">{t('designLab.color1') || 'Color 1'}</label>
                      <input type="color" value={state.project.bgGradient.c1} onChange={e => state.updateProjectBg({ bgGradient: { ...state.project.bgGradient, c1: e.target.value } })} className="w-full h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">{t('designLab.color2') || 'Color 2'}</label>
                      <input type="color" value={state.project.bgGradient.c2} onChange={e => state.updateProjectBg({ bgGradient: { ...state.project.bgGradient, c2: e.target.value } })} className="w-full h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-[color:var(--text-tertiary)]">{t('designLab.angle') || 'Angle'}</label>
                      <span className="text-[9px] font-mono text-primary-gold">{state.project.bgGradient.angle}°</span>
                    </div>
                    <input type="range" min="0" max="360" value={state.project.bgGradient.angle} onChange={e => state.updateProjectBg({ bgGradient: { ...state.project.bgGradient, angle: parseInt(e.target.value) } })} className="w-full accent-primary-gold" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.bgImage') || 'Background Image'}</h4>
              <label className="flex items-center justify-center gap-2 py-3 bg-[color:var(--surface-2)] border border-dashed border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all cursor-pointer">
                <ImageIcon className="w-4 h-4 text-primary-gold" />
                <span className="text-xs font-semibold text-[color:var(--text-secondary)]">{t('designLab.uploadBgImage') || 'Upload BG Image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && state.setBgImage(e.target.files[0])} />
              </label>
            </div>
          </div>
        )}

        {/* ── LAYERS TAB ── */}
        {activeTab === 'layers' && (
          <div className="space-y-4">
            <LayerPanel state={state} />
            {state.activeLayer && <PropertyPanel state={state} />}
          </div>
        )}
      </div>
    </div>
  );
}


