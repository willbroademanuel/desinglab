'use client';

import React, { useState } from 'react';
import {
  Undo2, Redo2, Download, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight,
  Crop, UserRound
} from 'lucide-react';
import Link from 'next/link';
import type { DesignLabState } from '../useDesignLab';
import type { TextLayer, ImageLayer } from '../types';
import { GlobalCropModal } from '@tools/shared/components/GlobalCropModal';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface MobileToolbarProps {
  state: DesignLabState;
  onExport: () => void;
  onOpenSettings?: () => void;
}

export default function MobileToolbar({ state, onExport, onOpenSettings }: MobileToolbarProps) {
  const { t } = useTranslation();
  const [isCropping, setIsCropping] = useState(false);
  const activeLayer = state.activeLayer;
  const isText = activeLayer?.type === 'text';
  const textLayer = isText ? (activeLayer as TextLayer) : null;

  return (
    <>
      <div className="w-full shrink-0 flex flex-col gap-1.5 z-10 relative">
        {/* Primary bar: Undo/Redo + Layer Chip + Export */}
        <div className="flex items-center justify-between gap-2 bg-[color:var(--surface-1)]/95 backdrop-blur-xl p-1.5 rounded-2xl border border-[color:var(--border-subtle)] shadow-lg">
          {/* Left: Undo/Redo */}
          <div className="flex items-center bg-[color:var(--surface-2)] rounded-xl p-0.5 shrink-0">
            <button
              onClick={state.undo}
              disabled={!state.canUndo}
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-all text-[color:var(--text-tertiary)] active:scale-90 disabled:opacity-25"
              aria-label="Undo"
            >
              <Undo2 className="w-[18px] h-[18px]" />
            </button>
            <div className="w-px h-5 bg-[color:var(--border-subtle)]" />
            <button
              onClick={state.redo}
              disabled={!state.canRedo}
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-all text-[color:var(--text-tertiary)] active:scale-90 disabled:opacity-25"
              aria-label="Redo"
            >
              <Redo2 className="w-[18px] h-[18px]" />
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: Export and User Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-4 h-10 bg-primary-gold text-black text-[11px] font-bold rounded-xl active:scale-95 transition-transform shadow-sm shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{t('designLab.export') || 'Export'}</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="flex h-10 items-center justify-center w-10 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold hover:text-primary-gold text-[color:var(--text-secondary)] rounded-xl transition-all shrink-0"
              title="User Settings"
            >
              <UserRound className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Secondary bar: Contextual layer actions — floats over canvas */}
        <div 
          className={`absolute top-full left-0 right-0 pt-2 transition-all duration-200 ease-out z-20 ${
            activeLayer ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden snap-x snap-mandatory px-0.5 pb-1">
            {/* Text-specific formatting ribbon */}
            {isText && textLayer && (
              <div className="flex items-center gap-0.5 bg-[color:var(--surface-1)]/95 backdrop-blur-xl border border-[color:var(--border-subtle)] p-0.5 rounded-xl shrink-0 snap-start shadow-lg">
                <div className="relative rounded-lg overflow-hidden w-9 h-9 border border-[color:var(--border-subtle)] shadow-sm flex items-center justify-center" title="Text Color">
                  <input
                    type="color"
                    value={textLayer.color}
                    onChange={e => state.updateLayer(textLayer.id, { color: e.target.value } as any)}
                    className="absolute inset-[-8px] w-14 h-14 cursor-pointer bg-transparent border-0"
                  />
                </div>

                <div className="relative rounded-lg overflow-hidden w-9 h-9 border border-dashed border-[color:var(--border-subtle)] shadow-sm flex items-center justify-center" title="Stroke Color">
                  <input
                    type="color"
                    value={textLayer.strokeColor}
                    onChange={e => state.updateLayer(textLayer.id, { strokeColor: e.target.value } as any)}
                    className="absolute inset-[-8px] w-14 h-14 cursor-pointer bg-transparent border-0"
                  />
                </div>

                <div className="w-px h-6 bg-[color:var(--border-subtle)] mx-0.5" />

                <button
                  onClick={() => state.updateLayer(textLayer.id, { isBold: !textLayer.isBold } as any)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90 ${textLayer.isBold ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-2)]'}`}
                >
                  <Bold className="w-4 h-4" />
                </button>

                <button
                  onClick={() => state.updateLayer(textLayer.id, { isItalic: !textLayer.isItalic } as any)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90 ${textLayer.isItalic ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-2)]'}`}
                >
                  <Italic className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-[color:var(--border-subtle)] mx-0.5" />

                {(['left', 'center', 'right'] as const).map(align => (
                  <button
                    key={align}
                    onClick={() => state.updateLayer(textLayer.id, { textAlign: align } as any)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90 ${(textLayer.textAlign || 'center') === align ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-2)]'}`}
                  >
                    {align === 'left' && <AlignLeft className="w-4 h-4" />}
                    {align === 'center' && <AlignCenter className="w-4 h-4" />}
                    {align === 'right' && <AlignRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isCropping && activeLayer?.type === 'image' && (
        <GlobalCropModal
          file={(activeLayer as ImageLayer).file}
          onConfirm={(croppedFile: File) => {
            state.updateLayer(activeLayer.id, { file: croppedFile } as any);
            setIsCropping(false);
          }}
          onCancel={() => setIsCropping(false)}
        />
      )}
    </>
  );
}


