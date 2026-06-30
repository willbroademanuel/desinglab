'use client';

// ==============================================================================
// DESIGNLAB — New Project Modal
// Canvas preset selector + custom size input
// ==============================================================================

import React, { useState, useMemo } from 'react';
import {
  X, Smartphone, Monitor, Printer, Film, Plus, Layers
} from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import { CANVAS_PRESETS } from '../constants';
import { constrainDimensions, getDeviceCapability } from '../utils';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface NewProjectModalProps {
  state: DesignLabState;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  social: Smartphone,
  carousel: Layers,
  video: Film,
  print: Printer,
  custom: Monitor,
};

const getCategoryLabels = (t: any): Record<string, string> => ({
  social: t('designLab.catSocial'),
  carousel: t('designLab.catCarousel'),
  video: t('designLab.catVideo'),
  print: t('designLab.catPrint'),
  custom: t('designLab.catCustom'),
});

export default function NewProjectModal({ state, onClose }: NewProjectModalProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('social');
  const [customW, setCustomW] = useState<number | ''>(1080);
  const [customH, setCustomH] = useState<number | ''>(1080);
  const [carouselSlides, setCarouselSlides] = useState(3);
  const [carouselRatio, setCarouselRatio] = useState<'square' | 'portrait'>('square');
  const { isMobile, maxCanvasDim } = useMemo(() => getDeviceCapability(), []);

  const categories = isMobile ? ['social', 'carousel', 'video', 'print'] : ['social', 'carousel', 'video', 'print', 'custom'];
  const filteredPresets = useMemo(
    () => CANVAS_PRESETS.filter(p => p.category === activeCategory),
    [activeCategory]
  );

  const handleSelect = (w: number, h: number) => {
    const { width, height } = constrainDimensions(w, h);
    state.createProject(width, height);
    onClose();
  };

  const handleCustom = () => {
    const w = Number(customW) || 0;
    const h = Number(customH) || 0;
    if (w < 50 || h < 50) return;
    handleSelect(w, h);
  };

  const handleCarousel = () => {
    const slideH = carouselRatio === 'portrait' ? 1350 : 1080;
    const w = 1080 * carouselSlides;
    const { width, height } = constrainDimensions(w, slideH);
    state.createProject(width, height, carouselSlides, 1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[color:var(--surface-1)] rounded-2xl border border-[color:var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-[color:var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-[color:var(--text-primary)]">
              <Plus className="w-5 h-5 text-primary-gold" /> {t('designLab.newDesign') || 'New Design'}
            </h2>
            <p className="text-xs text-[color:var(--text-tertiary)] mt-0.5">{t('designLab.chooseCanvas') || 'Choose a canvas size to get started'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex p-1 mx-5 mt-4 bg-[color:var(--surface-2)] rounded-xl border border-[color:var(--border-subtle)]">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? 'bg-[color:var(--surface-1)] text-primary-gold shadow-sm'
                    : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] sm:text-xs">{getCategoryLabels(t)[cat]}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hidden">
          {activeCategory !== 'custom' && activeCategory !== 'carousel' ? (
            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
              {filteredPresets.map(preset => {
                const isPortrait = preset.height > preset.width;
                const isSquare = preset.width === preset.height;
                const aspectW = isSquare ? 1 : isPortrait ? 0.65 : 1;
                const aspectH = isSquare ? 1 : isPortrait ? 1 : 0.65;

                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelect(preset.width, preset.height)}
                    className="group flex flex-col items-center gap-2 p-4 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-2xl hover:border-primary-gold hover:shadow-lg hover:shadow-primary-gold/10 transition-all active:scale-[0.97]"
                  >
                    {/* Visual preview */}
                    <div className="relative flex items-center justify-center h-16 w-full">
                      <div
                        className="border-2 border-[color:var(--text-tertiary)] group-hover:border-primary-gold rounded-lg transition-colors"
                        style={{
                          width: `${aspectW * (isMobile ? 40 : 50)}px`,
                          height: `${aspectH * (isMobile ? 40 : 50)}px`,
                        }}
                      />
                    </div>

                    <span className="text-xs font-bold text-[color:var(--text-primary)] text-center leading-tight">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono text-[color:var(--text-tertiary)]">
                      {preset.width} × {preset.height}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : activeCategory === 'carousel' ? (
            /* IG Carousel Setup */
            <div className="max-w-md mx-auto space-y-6 py-6">
              <div className="flex items-center justify-center h-24">
                <div
                  className="flex border-2 border-primary-gold rounded-lg transition-all overflow-hidden"
                  style={{
                    height: '80px',
                    width: `${Math.min(280, 80 * carouselSlides * (1080 / (carouselRatio === 'portrait' ? 1350 : 1080)))}px`,
                  }}
                >
                  {Array.from({ length: carouselSlides }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-primary-gold/50 border-dashed last:border-r-0 bg-primary-gold/10" />
                  ))}
                </div>
              </div>

              <div className="space-y-4 bg-[color:var(--surface-2)] p-4 rounded-xl border border-[color:var(--border-subtle)]">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-primary)]">{t('designLab.numSlides') || 'Number of Slides'}</label>
                    <span className="text-xs font-mono font-bold text-primary-gold bg-primary-gold/10 px-2 py-0.5 rounded-md">{carouselSlides}</span>
                  </div>
                  <input
                    type="range" min="2" max="10" value={carouselSlides}
                    onChange={e => setCarouselSlides(parseInt(e.target.value))}
                    className="w-full accent-primary-gold"
                  />
                  <div className="flex justify-between text-[10px] text-[color:var(--text-tertiary)] font-bold">
                    <span>2</span>
                    <span>Max 10</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-primary)]">{t('designLab.slideHeight') || 'Slide Height'}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCarouselRatio('square')}
                      className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-bold rounded-lg border transition-all leading-tight ${carouselRatio === 'square' ? 'bg-primary-gold text-black border-primary-gold shadow-sm' : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] text-[color:var(--text-secondary)]'}`}
                    >
                      <span>{t('designLab.square') || 'Square'}</span>
                      <span className="text-[10px] opacity-90 font-medium">(1080×1080)</span>
                    </button>
                    <button
                      onClick={() => setCarouselRatio('portrait')}
                      className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-bold rounded-lg border transition-all leading-tight ${carouselRatio === 'portrait' ? 'bg-primary-gold text-black border-primary-gold shadow-sm' : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] text-[color:var(--text-secondary)]'}`}
                    >
                      <span>{t('designLab.portrait') || 'Portrait'}</span>
                      <span className="text-[10px] opacity-90 font-medium">(1080×1350)</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCarousel}
                className="w-full py-3.5 bg-primary-gold text-black font-bold rounded-xl hover:bg-yellow-500 active:scale-[0.98] transition-all shadow-sm text-sm"
              >
                {t('designLab.createCanvas') || 'Create'} {carouselSlides * 1080} × {carouselRatio === 'portrait' ? 1350 : 1080}
              </button>
            </div>
          ) : (
            /* Custom size */
            <div className="max-w-sm mx-auto space-y-6 py-6">
              <div className="flex items-center justify-center h-24">
                <div
                  className="border-2 border-primary-gold rounded-lg transition-all"
                  style={{
                    width: `${Math.min(80, ((Number(customW) || 50) / Math.max(Number(customW) || 50, Number(customH) || 50)) * 80)}px`,
                    height: `${Math.min(80, ((Number(customH) || 50) / Math.max(Number(customW) || 50, Number(customH) || 50)) * 80)}px`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">{t('designLab.widthPx') || 'Width (px)'}</label>
                  <input
                    type="number"
                    min={50}
                    max={maxCanvasDim}
                    value={customW}
                    onChange={e => setCustomW(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                    className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-primary-gold transition-colors text-center"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">{t('designLab.heightPx') || 'Height (px)'}</label>
                  <input
                    type="number"
                    min={50}
                    max={maxCanvasDim}
                    value={customH}
                    onChange={e => setCustomH(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                    className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-primary-gold transition-colors text-center"
                  />
                </div>
              </div>

              {(Number(customW) > maxCanvasDim || Number(customH) > maxCanvasDim) && (
                <p className="text-[10px] text-orange-500 text-center font-semibold">
                  ⚠ {t('designLab.maxDimWarning', { max: maxCanvasDim }) || `Max dimension for your device: ${maxCanvasDim}px. Canvas will be scaled down.`}
                </p>
              )}

              <button
                onClick={handleCustom}
                className="w-full py-3.5 bg-primary-gold text-black font-bold rounded-xl hover:bg-yellow-500 active:scale-[0.98] transition-all shadow-sm text-sm"
              >
                {t('designLab.createCanvas') || 'Create'} {Number(customW) || 50} × {Number(customH) || 50}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
