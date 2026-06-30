'use client';

// ==============================================================================
// DESIGNLAB — Image Edit Panel
// Contextual overlay for image-specific tools (Background Removal, etc.)
// ==============================================================================

import React from 'react';
import { X, Wand2, AlertCircle } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import PropertyPanel from './PropertyPanel';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface ImageEditPanelProps {
  state: DesignLabState;
  onClose: () => void;
  onBgRemoval: () => void;
}

export default function ImageEditPanel({ state, onClose, onBgRemoval }: ImageEditPanelProps) {
  const { t } = useTranslation();
  const layer = state.activeLayer;
  const { isProcessing, progress, error } = state.bgRemovalState;

  // Render only if an image is actively selected
  if (!layer || layer.type !== 'image') return null;

  return (
    <div className="absolute inset-0 bg-[color:var(--surface-1)] z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-primary)]">
          {t('designLab.imageEdit' as any) || 'Image Edits'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-1)] transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          {/* BG Removal Button with live progress */}
          <button
            onClick={onBgRemoval}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 relative overflow-hidden"
          >
            {/* Live progress bar behind button text */}
            {isProcessing && (
              <div
                className="absolute inset-0 bg-white/20 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {progress > 0 ? `${progress}%` : 'Loading AI Model...'}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {t('designLab.aiBgRemoval' as any) || 'AI Background Removal'}
                </>
              )}
            </span>
          </button>

          {/* Error feedback */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <PropertyPanel state={state} />
        </div>
      </div>
    </div>
  );
}
