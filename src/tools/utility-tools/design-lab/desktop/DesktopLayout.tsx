'use client';

import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize, Plus } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';
import DesktopToolbar from './DesktopToolbar';
import DesktopSidebar from './DesktopSidebar';
import CanvasRenderer from '../shared/CanvasRenderer';
import ExportModal from '../shared/ExportModal';
import NewProjectModal from '../shared/NewProjectModal';
import { clamp } from '../utils';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface DesktopLayoutProps {
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

export default function DesktopLayout({ 
  state, zoom, onZoomChange, 
  panX, panY, onPanChange,
  showNewProject, setShowNewProject,
  showExportModal, setShowExportModal,
  handleBgRemoval,
  onOpenSettings
}: DesktopLayoutProps) {
  const { t } = useTranslation();
  const [isUniversalEditOpen, setIsUniversalEditOpen] = useState(false);
  const [isPillVisible, setIsPillVisible] = useState(true);
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
    <ErrorBoundary fallbackMessage="The desktop editor layout encountered an error.">
      <div className="flex flex-col flex-1 h-full min-h-0 w-full gap-2 p-2 sm:p-3 relative">
        
        {/* Toolbar */}
        <DesktopToolbar 
          state={state} 
          onExport={() => setShowExportModal(true)}
          isUniversalEditOpen={isUniversalEditOpen}
          setIsUniversalEditOpen={setIsUniversalEditOpen}
          isPillVisible={isPillVisible}
          onOpenSettings={onOpenSettings}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 gap-2 w-full">
          {/* Desktop Sidebar */}
          <DesktopSidebar 
            state={state} 
            onBgRemoval={handleBgRemoval} 
            isUniversalEditOpen={isUniversalEditOpen}
            setIsUniversalEditOpen={setIsUniversalEditOpen}
          />
          
          {/* Canvas Area */}
          <div className="flex-1 w-full flex flex-col relative min-h-0">
            <CanvasRenderer 
              state={state} zoom={zoom} panX={panX} panY={panY} 
              onZoomChange={onZoomChange} onPanChange={onPanChange} 
              canvasRef={canvasRef} 
              onPillVisibilityChange={setIsPillVisible} 
            />
            
            {/* Top Right Controls: Fit to Screen */}
            <div className="absolute top-4 right-4 z-10 pointer-events-auto">
              <button 
                onClick={() => { onZoomChange(1); onPanChange(0, 0); }} 
                className="w-9 h-9 flex justify-center items-center rounded-xl bg-[color:var(--surface-2)]/90 backdrop-blur-xl border border-[color:var(--border-subtle)] shadow-lg hover:bg-[color:var(--surface-1)] hover:text-[color:var(--text-primary)] active:scale-95 transition-all text-[color:var(--text-tertiary)]" 
                title="Fit to Screen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
            
            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
              
              {/* Left: New Design Button */}
              <button 
                onClick={() => setShowNewProject(true)}
                className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--surface-1)]/50 backdrop-blur-xl border border-[color:var(--border-subtle)] rounded-lg shadow-sm hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)] active:scale-95 transition-all text-xs font-medium text-[color:var(--text-tertiary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('designLab.newDesign') || 'New Design'}
              </button>

              {/* Right: Zoom Slider */}
              <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-[color:var(--surface-2)]/90 backdrop-blur-xl border border-[color:var(--border-subtle)] rounded-xl shadow-lg">
                <button onClick={() => onZoomChange(clamp(zoom - 0.1, 0.1, 3))} className="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors active:scale-95">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input 
                  type="range" 
                  min="10" max="300" 
                  value={Math.round(zoom * 100)} 
                  onChange={(e) => onZoomChange(parseInt(e.target.value) / 100)}
                  className="w-32 accent-primary-gold"
                />
                <button onClick={() => onZoomChange(clamp(zoom + 0.1, 0.1, 3))} className="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors active:scale-95">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-[color:var(--border-subtle)] mx-1" />
                <div className="w-10 text-xs font-mono font-bold text-primary-gold text-right">{Math.round(zoom * 100)}%</div>
              </div>

            </div>
          </div>
        </div>

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
      </div>
    </ErrorBoundary>
  );
}




