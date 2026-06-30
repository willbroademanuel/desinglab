'use client';

import React, { useState, useMemo } from 'react';
import {
  Type, Image as ImageIcon, Square, Circle, Triangle, Star,
  Minus, ArrowRight, ArrowBigRight, Heart, Hexagon,
  Palette, Trash2, Layers, Wand2, Library, ChevronDown, Crop, Plus
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import type { DesignLabState } from '../useDesignLab';
import type { ShapeKind, SidebarTab } from '../types';
import { ImageUploader } from '@tools/shared/components/ImageUploader';
import { GlobalCropModal } from '@tools/shared/components/GlobalCropModal';
import { FONT_LIST, FILL_COLORS, BG_SOLID_COLORS, BG_GRADIENTS } from '../constants';
import { loadGoogleFont } from '../utils';
import PropertyPanel from '../shared/PropertyPanel';
import FontPicker from '../shared/FontPicker';
import LayerPanel from '../shared/LayerPanel';
import AssetBrowser from '../shared/AssetBrowser';
import UniversalEditPanel from '../shared/UniversalEditPanel';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface MobileSidebarProps {
  state: DesignLabState;
  onBgRemoval: () => void;
}

const SHAPES: { kind: ShapeKind; icon: any; label: string }[] = [
  { kind: 'rectangle', icon: Square, label: 'Square' },
  { kind: 'circle', icon: Circle, label: 'Circle' },
  { kind: 'triangle', icon: Triangle, label: 'Triangle' },
  { kind: 'star', icon: Star, label: 'Star' },
  { kind: 'line', icon: Minus, label: 'Line' },
  { kind: 'arrow', icon: ArrowBigRight, label: 'Arrow' },
  { kind: 'heart', icon: Heart, label: 'Heart' },
  { kind: 'hexagon', icon: Hexagon, label: 'Hexagon' },
];

export default function MobileSidebar({ state, onBgRemoval }: MobileSidebarProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SidebarTab | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const dragControls = useDragControls();

  // Handle pointer loss during peek mode
  React.useEffect(() => {
    if (!activeSlider) return;
    const handleUp = () => setActiveSlider(null);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [activeSlider]);

  const filteredFonts = useMemo(() => {
    if (!fontSearch) return FONT_LIST;
    const q = fontSearch.toLowerCase();
    return FONT_LIST.filter(f => f.name.toLowerCase().includes(q));
  }, [fontSearch]);

  const TABS: { id: SidebarTab; icon: any; label: string }[] = [
    { id: 'elements', icon: Square, label: t('designLab.elements') || 'Elements' },
    { id: 'layers', icon: Layers, label: t('designLab.layers') || 'Layers' },
    { id: 'background', icon: Palette, label: t('designLab.bgSettings') || 'BG Settings' },
  ];

  const handleImageUpload = (file: File) => {
    setPendingUploadFile(file);
  };

  const autoCloseOnMobile = () => {
    setActiveTab(null);
  };

  React.useEffect(() => {
    // If we're on the 'edit' tab but no layer is selected, auto-close the drawer
    if (activeTab === 'edit' && !state.activeLayer) {
      setActiveTab(null);
    }
    // If the add menu is open but a layer gets selected, close it
    if (state.activeLayer && showAddMenu) {
      setShowAddMenu(false);
    }
  }, [state.activeLayer, activeTab, showAddMenu]);

  const allMobileTabs = TABS;

  return (
    <>
      <AnimatePresence>
        {activeTab ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              setActiveTab(null);
            }
          }}
          className={`fixed bottom-0 left-0 right-0 z-[60] pb-safe flex flex-col rounded-t-[28px] will-change-transform transition-colors duration-300 ${activeSlider ? '!bg-transparent border-transparent shadow-none !backdrop-blur-none' : 'bg-[color:var(--surface-1)]/95 backdrop-blur-2xl border-t border-[color:var(--border-subtle)] shadow-[0_-8px_40px_rgba(0,0,0,0.3)]'}`}
          style={{ maxHeight: '80vh' }}
          data-mobile-panel="true"
        >
          {/* Drag Handle */}
          <div
            className={`w-full h-10 flex justify-center items-center shrink-0 cursor-grab active:cursor-grabbing touch-none transition-opacity duration-300 ${activeSlider ? 'opacity-0' : 'opacity-100'}`}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-10 h-1 bg-[color:var(--text-tertiary)]/30 rounded-full" />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            {/* Header: Tab name + Actions */}
            <div className={`flex items-center justify-between px-4 pb-3 shrink-0 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[color:var(--text-primary)]">
                  {activeTab === 'edit' ? 'Edit Layer' : activeTab === 'assets' ? 'Stock Assets' : allMobileTabs.find(t => t.id === activeTab)?.label || 'Tools'}
                </h3>
                <span className="text-[9px] font-mono text-[color:var(--text-tertiary)] bg-[color:var(--surface-2)] px-1.5 py-0.5 rounded-md">
                  {state.project.layers.length} layers
                </span>
              </div>
              <div className="flex items-center gap-2">
                {confirmClear ? (
                  <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 rounded-xl animate-in fade-in duration-200">
                    <span className="text-[10px] font-bold text-red-500">Sure?</span>
                    <button onClick={() => { state.clearProject(); setConfirmClear(false); setActiveTab(null); }} className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg shadow-sm">Yes</button>
                    <button onClick={() => setConfirmClear(false)} className="px-2.5 py-1 bg-[color:var(--surface-2)] text-[color:var(--text-secondary)] text-[10px] font-bold rounded-lg border border-[color:var(--border-subtle)]">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1 px-2.5 h-8 bg-red-500/8 border border-red-500/15 rounded-xl text-red-500 active:scale-95 transition-transform"
                    aria-label="Clear Workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">{t('imageFilters.clearWorkspace') || 'Clear'}</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab(null)}
                  className="w-8 h-8 flex items-center justify-center bg-[color:var(--surface-2)] rounded-xl text-[color:var(--text-secondary)] active:scale-90 transition-transform shadow-sm shrink-0 border border-[color:var(--border-subtle)]"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className={`flex items-center gap-1 px-3 pb-3 overflow-x-auto scrollbar-hidden shrink-0 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              {allMobileTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-primary-gold/15 text-primary-gold border border-primary-gold/30 shadow-sm'
                      : 'text-[color:var(--text-tertiary)] border border-transparent active:scale-95'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-[11px] font-bold">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className={`h-px bg-[color:var(--border-subtle)] mx-4 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 touch-pan-y overscroll-contain">
              {activeTab === 'elements' && (
                <div className={`space-y-5 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-3">
                      {t('designLab.shapes') || 'Shapes'}
                    </h4>
                    <div className="grid grid-cols-4 gap-2.5">
                      {SHAPES.map(s => (
                        <button
                          key={s.kind}
                          onClick={() => { state.addShapeLayer(s.kind); autoCloseOnMobile(); }}
                          className="flex flex-col items-center gap-2 py-3.5 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-2xl active:scale-[0.92] transition-transform shadow-sm"
                        >
                          <s.icon className="w-6 h-6 text-primary-gold" />
                          <span className="text-[10px] font-semibold text-[color:var(--text-secondary)]">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-3">
                      {t('designLab.assets' as any) === 'designLab.assets' ? 'Stock Photos' : t('designLab.assets' as any)}
                    </h4>
                    <button
                      onClick={() => setActiveTab('assets')}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
                    >
                      <Library className="w-5 h-5 text-primary-gold" />
                      <span className="text-sm font-bold">{t('designLab.browseAssets' as any) === 'designLab.browseAssets' ? 'Free Stock Photos' : t('designLab.browseAssets' as any)}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'assets' && (
                <div className={`h-[65vh] flex flex-col transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <AssetBrowser state={state} onAssetAdded={autoCloseOnMobile} />
                </div>
              )}

              {activeTab === 'layers' && (
                <div className={`space-y-4 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <LayerPanel state={state} />
                </div>
              )}

              {activeTab === 'background' && (
                <div className={`space-y-4 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <button
                    onClick={() => { state.updateProjectBg({ bgType: 'transparent' }); autoCloseOnMobile(); }}
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
                          onClick={() => { state.updateProjectBg({ bgType: 'solid', bgColor: c }); autoCloseOnMobile(); }}
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
                          onClick={() => { state.updateProjectBg({ bgType: 'gradient', bgGradient: { c1: g.c1, c2: g.c2, angle: 135 } }); autoCloseOnMobile(); }}
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
                      <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { state.setBgImage(e.target.files[0]); autoCloseOnMobile(); } }} />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'edit' && (
                <div className="space-y-4">
                  {state.activeLayer ? (
                    <>
                      {state.activeLayer.type === 'text' && (
                        <div className={`space-y-3 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                          {/* Style preset quick-add buttons */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => { state.addHeadingLayer(); autoCloseOnMobile(); }}
                              className="flex flex-col items-start gap-0.5 px-3 py-2 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all active:scale-95"
                            >
                              <span className="text-sm font-black text-[color:var(--text-primary)] leading-none">Heading</span>
                              <span className="text-[9px] text-[color:var(--text-tertiary)]">Montserrat · 800</span>
                            </button>
                            <button
                              onClick={() => { state.addSubheadingLayer(); autoCloseOnMobile(); }}
                              className="flex flex-col items-start gap-0.5 px-3 py-2 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all active:scale-95"
                            >
                              <span className="text-xs font-semibold text-[color:var(--text-primary)] leading-none">Subheading</span>
                              <span className="text-[9px] text-[color:var(--text-tertiary)]">Poppins · 600</span>
                            </button>
                            <button
                              onClick={() => { state.addBodyTextLayer(); autoCloseOnMobile(); }}
                              className="flex flex-col items-start gap-0.5 px-3 py-2 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all active:scale-95"
                            >
                              <span className="text-[10px] font-normal text-[color:var(--text-primary)] leading-none">Body text</span>
                              <span className="text-[9px] text-[color:var(--text-tertiary)]">Inter · 400</span>
                            </button>
                            <button
                              onClick={() => { state.addCaptionLayer(); autoCloseOnMobile(); }}
                              className="flex flex-col items-start gap-0.5 px-3 py-2 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-xl transition-all active:scale-95"
                            >
                              <span className="text-[9px] font-light tracking-widest text-[color:var(--text-primary)] leading-none uppercase">CAPTION</span>
                              <span className="text-[9px] text-[color:var(--text-tertiary)]">Inter · 300</span>
                            </button>
                          </div>

                          {/* Font family picker */}
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] mb-2">{t('designLab.fontFamily') || 'Font Family'}</h4>
                            <FontPicker
                              currentFont={(state.activeLayer as any).fontFamily || 'Inter'}
                              currentWeight={(state.activeLayer as any).fontWeight ?? 400}
                              onFontChange={(fontName) => state.updateLayer(state.activeLayer!.id, { fontFamily: fontName } as any)}
                              onWeightChange={(weight) => state.updateLayer(state.activeLayer!.id, { fontWeight: weight, isBold: weight >= 700 } as any)}
                              maxHeight={180}
                            />
                          </div>
                        </div>
                      )}
                      {state.activeLayer.type === 'image' && (
                        <div className={`flex flex-col gap-2 transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsCropping(true)}
                              disabled={state.bgRemovalState.isProcessing}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] font-bold rounded-xl hover:bg-[color:var(--surface-1)] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              <Crop className="w-4 h-4" /> Crop
                            </button>
                            <button
                              onClick={() => { onBgRemoval(); autoCloseOnMobile(); }}
                              disabled={state.bgRemovalState.isProcessing}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-70 relative overflow-hidden"
                            >
                              {state.bgRemovalState.isProcessing && (
                                <div className="absolute inset-0 bg-white/20 transition-all duration-300" style={{ width: `${state.bgRemovalState.progress}%` }} />
                              )}
                              <span className="relative flex items-center gap-1.5">
                                {state.bgRemovalState.isProcessing ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    {state.bgRemovalState.progress > 0 ? `${state.bgRemovalState.progress}%` : 'Loading...'}
                                  </>
                                ) : (
                                  <><Wand2 className="w-4 h-4" /> BG Removal</>
                                )}
                              </span>
                            </button>
                          </div>
                          {state.bgRemovalState.error && (
                            <p className="text-xs text-red-400 font-semibold px-1">{state.bgRemovalState.error}</p>
                          )}
                        </div>
                      )}
                      
                      <div className={`p-3 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl flex items-center gap-3 transition-opacity duration-300 ${activeSlider && activeSlider !== 'opacity' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <span className="text-xs font-bold text-[color:var(--text-tertiary)] uppercase tracking-wider">Opacity</span>
                        <input
                          type="range"
                          min="0" max="100"
                          value={Math.round(state.activeLayer.opacity * 100)}
                          onChange={e => state.updateSelectedLayers({ opacity: parseInt(e.target.value) / 100 })}
                          onPointerDown={() => setActiveSlider('opacity')}
                          className="flex-1 accent-primary-gold relative z-10"
                        />
                        <span className="text-xs font-mono text-primary-gold w-10 text-right">{Math.round(state.activeLayer.opacity * 100)}%</span>
                      </div>

                      <div className={`transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <PropertyPanel state={state} />
                      </div>
                      <div className={`w-full h-px bg-[color:var(--border-subtle)] transition-opacity duration-300 ${activeSlider ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
                      
                      <UniversalEditPanel state={state} onClose={autoCloseOnMobile} inline activeSlider={activeSlider} setActiveSlider={setActiveSlider} />
                    </>
                  ) : (
                    <div className="py-10 text-center text-[color:var(--text-tertiary)] italic text-sm">
                      {t('designLab.selectElementToEdit' as any) === 'designLab.selectElementToEdit' ? 'Select an element to view edit options.' : t('designLab.selectElementToEdit' as any)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
        ) : (
          <motion.div
            key="dock"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[60] pb-safe pointer-events-none"
            data-mobile-panel="true"
          >
            <div className="mx-4 mb-4 h-16 flex items-center justify-between px-6 bg-[color:var(--surface-1)]/95 backdrop-blur-3xl border border-[color:var(--border-subtle)] rounded-3xl shadow-[0_-4px_30px_rgba(0,0,0,0.25)] pointer-events-auto relative">
              
              {/* Left: Elements */}
              <button
                onClick={() => setActiveTab('elements')}
                className="flex flex-col items-center gap-1 active:scale-90 transition-all p-2"
              >
                <Square className={`w-5 h-5 ${activeTab === 'elements' ? 'text-primary-gold' : 'text-[color:var(--text-secondary)]'}`} />
                <span className={`text-[9px] font-bold ${activeTab === 'elements' ? 'text-primary-gold' : 'text-[color:var(--text-tertiary)]'}`}>{t('designLab.elements') || 'Elements'}</span>
              </button>

              {/* Middle FAB (The Sink) */}
              <div className="absolute left-1/2 -top-6 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                
                {/* Pop-out Pills */}
                <AnimatePresence>
                  {showAddMenu && !state.activeLayer && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.9 }}
                      className="absolute bottom-[4.5rem] flex items-center gap-3 pointer-events-auto"
                    >
                      <button 
                        onClick={() => { state.addTextLayer(); setShowAddMenu(false); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold text-[color:var(--text-primary)]"
                      >
                        <Type className="w-4 h-4 text-primary-gold" />
                        Text
                      </button>
                      
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold text-[color:var(--text-primary)] cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-primary-gold" />
                        Image
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(e.target.files[0]);
                            setShowAddMenu(false);
                          }
                        }} />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* FAB Button */}
                <button
                  onClick={() => {
                    if (state.activeLayer) {
                      setActiveTab('edit');
                    } else {
                      setShowAddMenu(!showAddMenu);
                    }
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all pointer-events-auto border-4 border-[color:var(--surface-1)] ${
                    state.activeLayer 
                      ? 'bg-[color:var(--surface-2)] text-primary-gold' 
                      : 'bg-primary-gold text-black shadow-primary-gold/30'
                  }`}
                >
                  {state.activeLayer ? (
                    <Wand2 className="w-6 h-6" />
                  ) : (
                    <Plus className={`w-7 h-7 transition-transform duration-300 ${showAddMenu ? 'rotate-45' : ''}`} />
                  )}
                </button>
              </div>

              {/* Right: Layers */}
              <button
                onClick={() => setActiveTab('layers')}
                className="flex flex-col items-center gap-1 active:scale-90 transition-all p-2"
              >
                <Layers className={`w-5 h-5 ${activeTab === 'layers' ? 'text-primary-gold' : 'text-[color:var(--text-secondary)]'}`} />
                <span className={`text-[9px] font-bold ${activeTab === 'layers' ? 'text-primary-gold' : 'text-[color:var(--text-tertiary)]'}`}>{t('designLab.layers') || 'Layers'}</span>
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isCropping && state.activeLayer?.type === 'image' && (
        <GlobalCropModal
          file={(state.activeLayer as any).file}
          onConfirm={(croppedFile: File) => {
            state.updateLayer(state.activeLayer!.id, { file: croppedFile } as any);
            setIsCropping(false);
            autoCloseOnMobile();
          }}
          onCancel={() => setIsCropping(false)}
        />
      )}

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
    </>
  );
}
