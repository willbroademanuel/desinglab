'use client';

import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize, Plus, Lock, Unlock, Copy, Trash2, Info } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import MobileToolbar from './MobileToolbar';
import MobileSidebar from './MobileSidebar';
import CanvasRenderer from '../shared/CanvasRenderer';
import ExportModal from '../shared/ExportModal';
import NewProjectModal from '../shared/NewProjectModal';
import { clamp } from '../utils';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface MobileLayoutProps {
  state: DesignLabState;
  zoom: number;
  onZoomChange: (z: number) => void;
  panX: number;
  panY: number;
  onPanChange: (x: number, y: number) => void;
  showNewProject: boolean;
  setShowNewProject: (show: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  handleBgRemoval: () => void;
  onOpenSettings?: () => void;
}

export default function MobileLayout({ 
  state, zoom, onZoomChange, 
  panX, panY, onPanChange,
  showNewProject, setShowNewProject,
  showExportModal, setShowExportModal,
  handleBgRemoval,
  onOpenSettings
}: MobileLayoutProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (showNewProject && !state.hasProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-4">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-gold/10 border border-primary-gold/20 mb-2">
            <Plus className="w-8 h-8 text-primary-gold" />
          </div>
          <h2 className="text-2xl font-bold text-[color:var(--text-primary)]">
            {t('designLab.startCreating' as any) || 'Start Creating'}
          </h2>
          <p className="text-sm text-[color:var(--text-secondary)] max-w-sm mx-auto">
            {t('designLab.startCreatingDesc' as any) || 'Create a new design project or upload an image to get started.'}
          </p>
        </div>
        <NewProjectModal
          state={state}
          onClose={() => setShowNewProject(false)}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackMessage="The mobile editor layout encountered an error.">
      <div 
        className="flex flex-col flex-1 h-full min-h-0 w-full gap-2 p-2 pt-[calc(env(safe-area-inset-top)+8px)] relative pb-20"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          // Let CanvasRenderer handle its own canvas clicks
          if (target.tagName.toLowerCase() === 'canvas') return;
          
          // If clicking inside the mobile sidebar panel, do not deselect
          if (target.closest('[data-mobile-panel="true"]')) return;
          
          // If clicking empty space (not a tool button or input), deselect
          if (state.activeLayer && !target.closest('button') && !target.closest('input') && !target.closest('label')) {
            state.deselectAll();
          }
        }}
      >
        
        {/* Toolbar */}
        <MobileToolbar 
          state={state} 
          onExport={() => setShowExportModal(true)} 
          onOpenSettings={onOpenSettings}
        />

        {/* Canvas Area */}
        <div className="flex-1 w-full flex flex-col relative min-h-0">
          <CanvasRenderer state={state} zoom={zoom} panX={panX} panY={panY} onZoomChange={onZoomChange} onPanChange={onPanChange} canvasRef={canvasRef} />
          
          {/* Fit to Screen (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
            <button onClick={() => { onZoomChange(1); onPanChange(0, 0); }} className="w-9 h-9 flex justify-center items-center rounded-xl bg-[color:var(--surface-2)]/90 backdrop-blur-xl border border-[color:var(--border-subtle)] shadow-lg active:scale-95 transition-all text-[color:var(--text-primary)]" title="Fit to Screen">
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* Fixed Layer Toolbar for non-text layers */}
          {state.activeLayer && state.activeLayer.type !== 'text' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
              <div className="flex items-center gap-2 px-3 py-2 bg-[color:var(--surface-1)]/95 backdrop-blur-xl shadow-xl rounded-full border border-[color:var(--border-subtle)]">
                <button
                  onClick={() => state.updateLayer(state.activeLayer!.id, { locked: !state.activeLayer!.locked } as any)}
                  className={`p-1.5 rounded-full transition-colors ${state.activeLayer.locked ? 'bg-primary-gold/20 text-primary-gold' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-2)]'}`}
                >
                  {state.activeLayer.locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>
                <div className="w-px h-6 bg-[color:var(--border-subtle)] mx-0.5" />
                <button
                  onClick={() => state.duplicateLayer(state.activeLayer!.id)}
                  className="p-1.5 rounded-full transition-colors text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-2)]"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => state.deleteLayer(state.activeLayer!.id)}
                  className="p-1.5 rounded-full transition-colors text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls (Bottom Right horizontally) */}
          <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex items-center gap-1 bg-[color:var(--surface-2)]/90 backdrop-blur-xl p-1 rounded-xl border border-[color:var(--border-subtle)] shadow-lg">
            <button onClick={() => onZoomChange(clamp(zoom - 0.1, 0.1, 3))} className="w-8 h-8 flex justify-center items-center rounded-lg hover:bg-[color:var(--surface-1)] active:scale-95 transition-all text-[color:var(--text-secondary)]">
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono text-center font-bold text-primary-gold w-8">{Math.round(zoom * 100)}%</div>
            <button onClick={() => onZoomChange(clamp(zoom + 0.1, 0.1, 3))} className="w-8 h-8 flex justify-center items-center rounded-lg hover:bg-[color:var(--surface-1)] active:scale-95 transition-all text-[color:var(--text-secondary)]">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Mobile Sidebar (Bottom Dock / Sheet) */}
        <MobileSidebar 
          state={state} 
          onBgRemoval={handleBgRemoval} 
        />

        {showExportModal && (
          <ExportModal
            state={state}
            onClose={() => setShowExportModal(false)}
            canvasRef={canvasRef}
          />
        )}

        {showNewProject && state.hasProject && (
          <NewProjectModal
            state={state}
            onClose={() => setShowNewProject(false)}
          />
        )}

        {/* Floating Circular Progress Modal for BG Removal */}
        {state.bgRemovalState.isProcessing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="bg-[color:var(--surface-1)]/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border border-[color:var(--border-subtle)] flex flex-col items-center gap-4 pointer-events-auto">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="stroke-[color:var(--surface-2)]" strokeWidth="10" fill="none" />
                  <circle 
                    cx="50" cy="50" r="40" 
                    className="stroke-primary-gold drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
                    strokeWidth="10" fill="none" strokeLinecap="round" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (251.2 * state.bgRemovalState.progress) / 100} 
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }} 
                  />
                </svg>
                <span className="absolute text-xl font-black text-[color:var(--text-primary)]">
                  {state.bgRemovalState.progress}%
                </span>
              </div>
              <span className="text-sm font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-center px-4">
                {t('designLab.bgRemovingProgress' as any) || 'Removing Background...'}
              </span>
              
              <div className="flex items-start gap-2 mt-2 px-4 py-3 bg-[color:var(--surface-2)]/50 rounded-xl border border-[color:var(--border-subtle)] max-w-xs w-full">
                <Info className="w-4 h-4 text-primary-gold shrink-0 mt-0.5" />
                <p className="text-[10px] text-[color:var(--text-tertiary)] leading-relaxed text-left">
                  {t('designLab.bgRemovingNote' as any) || 'Processing locally on your device. Time may vary depending on hardware performance.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}




