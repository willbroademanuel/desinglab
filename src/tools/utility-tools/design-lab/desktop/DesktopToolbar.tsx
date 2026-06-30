'use client';

import React, { useState } from 'react';
import {
  Undo2, Redo2, Trash2, Download, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight,
  MousePointer2, Hand, Crop, Settings2,
  Lock, Unlock, Copy
} from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import type { TextLayer, ToolMode, ImageLayer } from '../types';
import { GlobalCropModal } from '@tools/shared/components/GlobalCropModal';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface DesktopToolbarProps {
  state: DesignLabState;
  onExport: () => void;
  isUniversalEditOpen?: boolean;
  setIsUniversalEditOpen?: (open: boolean) => void;
  isPillVisible?: boolean;
}

export default function DesktopToolbar({ state, onExport, isUniversalEditOpen, setIsUniversalEditOpen, isPillVisible = true }: DesktopToolbarProps) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  
  const activeLayer = state.activeLayer;
  const isText = activeLayer?.type === 'text';
  const textLayer = isText ? (activeLayer as TextLayer) : null;

  const toolButtons: { mode: ToolMode; icon: any; label: string }[] = [
    { mode: 'select', icon: MousePointer2, label: 'Select' },
    { mode: 'pan', icon: Hand, label: 'Pan' },
  ];

  return (
    <div className="w-full shrink-0 flex flex-row items-center justify-between gap-2 bg-[color:var(--surface-1)] p-2 sm:px-3 sm:py-2 rounded-xl border border-[color:var(--border-subtle)] shadow-sm z-10">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hidden snap-x snap-mandatory">
        {/* Tool mode buttons */}
        <div className="flex bg-[color:var(--surface-2)] p-1 rounded-lg shrink-0 snap-start h-9 items-center">
            {toolButtons.map(t => (
              <button
                key={t.mode}
                onClick={() => state.setToolMode(t.mode)}
                className={`h-full px-2 flex items-center gap-1.5 text-xs font-bold rounded-md transition-all ${
                  state.toolMode === t.mode
                    ? 'bg-primary-gold text-black shadow-sm'
                    : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'
                }`}
                title={t.label}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>

        <div className="h-6 w-px bg-[color:var(--border-subtle)] shrink-0 snap-start" />

        {/* Undo / Redo */}
        <div className="flex bg-[color:var(--surface-2)] p-1 rounded-lg shrink-0 snap-start h-9 items-center">
          <button onClick={state.undo} disabled={!state.canUndo} className="w-7 h-full flex items-center justify-center text-xs rounded-md transition-all text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] disabled:opacity-30" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={state.redo} disabled={!state.canRedo} className="w-7 h-full flex items-center justify-center text-xs rounded-md transition-all text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] disabled:opacity-30" title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Universal Opacity */}
        {activeLayer && (
          <>
            <div className="h-6 w-px bg-[color:var(--border-subtle)] shrink-0 snap-start" />
            <div className="flex items-center gap-2 bg-[color:var(--surface-2)] px-2.5 py-1 h-9 rounded-lg shrink-0 w-40 sm:w-52 snap-start" title="Opacity">
              <span className="text-[9px] font-bold text-[color:var(--text-tertiary)] hidden sm:block">OPACITY</span>
              <input
                type="range"
                min="0" max="100"
                value={Math.round(activeLayer.opacity * 100)}
                onChange={e => state.updateSelectedLayers({ opacity: parseInt(e.target.value) / 100 })}
                className="w-full accent-primary-gold h-1"
              />
              <span className="text-[9px] font-mono w-7 text-right text-primary-gold">{Math.round(activeLayer.opacity * 100)}%</span>
            </div>
          </>
        )}

        {/* Text formatting */}
        {isText && textLayer && (
          <>
            <div className="h-6 w-px bg-[color:var(--border-subtle)] shrink-0 snap-start" />
            <div className="flex items-center gap-1 bg-[color:var(--surface-2)] p-1 rounded-lg shrink-0 snap-start h-9">
              <div className="flex items-center gap-1 px-1.5" title="Text Color">
                <span className="text-[8px] font-bold text-[color:var(--text-tertiary)] uppercase hidden sm:block">Fill</span>
                <div className="relative rounded-md overflow-hidden w-5 h-5 border border-[color:var(--border-subtle)] shadow-sm">
                  <input
                    type="color"
                    value={textLayer.color}
                    onChange={e => state.updateLayer(textLayer.id, { color: e.target.value } as any)}
                    className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 px-1.5 border-l border-[color:var(--border-subtle)]" title="Stroke Color">
                <span className="text-[8px] font-bold text-[color:var(--text-tertiary)] uppercase hidden sm:block">Line</span>
                <div className="relative rounded-md overflow-hidden w-5 h-5 border border-[color:var(--border-subtle)] shadow-sm">
                  <input
                    type="color"
                    value={textLayer.strokeColor}
                    onChange={e => state.updateLayer(textLayer.id, { strokeColor: e.target.value } as any)}
                    className="absolute inset-[-8px] w-10 h-10 cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>

              <div className="w-px h-4 bg-[color:var(--border-subtle)] mx-0.5" />

              <button
                onClick={() => state.updateLayer(textLayer.id, { isBold: !textLayer.isBold } as any)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${textLayer.isBold ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                onClick={() => state.updateLayer(textLayer.id, { isItalic: !textLayer.isItalic } as any)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${textLayer.isItalic ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-[color:var(--border-subtle)] mx-0.5" />

              {(['left', 'center', 'right'] as const).map(align => (
                <button
                  key={align}
                  onClick={() => state.updateLayer(textLayer.id, { textAlign: align } as any)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${(textLayer.textAlign || 'center') === align ? 'bg-primary-gold text-black' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`}
                  title={`Align ${align}`}
                >
                  {align === 'left' && <AlignLeft className="w-4 h-4" />}
                  {align === 'center' && <AlignCenter className="w-4 h-4" />}
                  {align === 'right' && <AlignRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </>
        )}

        {activeLayer && activeLayer.type === 'image' && (
          <button
            onClick={() => setIsCropping(true)}
            className="flex w-9 h-9 justify-center items-center text-[color:var(--text-tertiary)] hover:text-primary-gold rounded-lg transition-colors shrink-0 snap-start bg-[color:var(--surface-2)]"
            title="Crop Image"
          >
            <Crop className="w-4 h-4" />
          </button>
        )}

        {/* Universal Edit Tools Button */}
        {activeLayer && (
          <>
            <div className="h-6 w-px bg-[color:var(--border-subtle)] shrink-0 snap-start" />
            <button
              onClick={() => setIsUniversalEditOpen?.(!isUniversalEditOpen)}
              className={`h-9 px-3.5 flex items-center justify-center gap-2 text-xs font-bold rounded-lg transition-all border snap-start ${
                isUniversalEditOpen
                  ? 'bg-primary-gold border-primary-gold text-black shadow-sm'
                  : 'bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] text-[color:var(--text-primary)] hover:border-primary-gold hover:text-primary-gold'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Edit Tools</span>
            </button>
          </>
        )}

        {/* Adaptive Fallback Tools (when pill is hidden) */}
        {activeLayer && !isPillVisible && (
          <>
            <div className="h-6 w-px bg-[color:var(--border-subtle)] shrink-0 snap-start" />
            <div className="flex bg-[color:var(--surface-2)] p-1 rounded-lg shrink-0 snap-start h-9 items-center">
              <button
                onClick={() => state.updateLayer(activeLayer.id, { locked: !activeLayer.locked } as any)}
                className={`w-7 h-full flex items-center justify-center text-xs rounded-md transition-all ${activeLayer.locked ? 'bg-primary-gold text-black shadow-sm' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'}`}
                title={activeLayer.locked ? "Unlock layer" : "Lock layer"}
              >
                {activeLayer.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                onClick={() => state.duplicateLayer(activeLayer.id)}
                className="w-7 h-full flex items-center justify-center text-xs rounded-md transition-all text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => state.deleteLayer(activeLayer.id)}
                className="w-7 h-full flex items-center justify-center text-xs rounded-md transition-all text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right section: delete, zoom, export */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {confirmClear ? (
          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 px-2 h-9 rounded-lg animate-in slide-in-from-right-2">
            <span className="text-[10px] font-bold text-red-500 uppercase px-1">{t('imageFilters.clearWorkspace') ? 'Are you sure?' : 'Are you sure?'}</span>
            <button
              onClick={() => { state.clearProject(); setConfirmClear(false); }}
              className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shadow-sm hover:bg-red-600 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-2 py-0.5 bg-[color:var(--surface-1)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] text-[10px] font-bold rounded shadow-sm transition-colors border border-[color:var(--border-subtle)]"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 h-9 bg-[color:var(--surface-2)] text-red-500 hover:bg-red-500/10 border border-[color:var(--border-subtle)] text-xs font-bold rounded-lg transition-all active:scale-[0.97] shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t('imageFilters.clearWorkspace') || 'Clear'}
          </button>
        )}

        <button
          onClick={onExport}
          className="flex h-9 items-center gap-1.5 px-3.5 bg-primary-gold text-black text-xs font-bold rounded-lg transition-all active:scale-[0.97] shadow-sm hover:bg-yellow-500 shrink-0"
        >
          <Download className="w-4 h-4" /> {t('designLab.export') || 'Export'}
        </button>
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
    </div>
  );
}


