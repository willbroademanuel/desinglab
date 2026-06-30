'use client';

// ==============================================================================
// DESIGNLAB — Main Entry Point (Controller)
// This file acts purely as the state orchestrator and platform router.
// It detects the device and routes to either MobileLayout or DesktopLayout.
// ==============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDesignLab } from './useDesignLab';
import { getDeviceCapability } from './utils';
import { useTranslation } from '@/lib/i18n/useTranslation';

import MobileLayout from './mobile/MobileLayout';
import DesktopLayout from './desktop/DesktopLayout';

export default function DesignLab() {
  const { t } = useTranslation();
  const state = useDesignLab();
  
  // Platform Detection
  const { isMobile } = useMemo(() => getDeviceCapability(), []);

  // Shared UI State
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [showNewProject, setShowNewProject] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        state.redo();
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (state.activeLayer && state.activeLayer.type !== 'text') { // Text layers handle their own delete when editing
          e.preventDefault();
          state.deleteLayer(state.activeLayer.id);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (state.activeLayer) {
          e.preventDefault();
          state.duplicateLayer(state.activeLayer.id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state]);

  // Robust Background Removal Handler
  const handleBgRemoval = useCallback(async () => {
    if (!state.activeLayer || state.activeLayer.type !== 'image') return;
    await state.removeBackground(state.activeLayer.id);
  }, [state]);

  // ── Loading State ──
  if (!state.isInitialized) {
    return (
      <div className="flex flex-col flex-1 h-full min-h-[60vh] w-full relative items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-gold"></div>
      </div>
    );
  }

  // ── Platform Routing ──
  if (isMobile) {
    return (
      <MobileLayout 
        state={state}
        zoom={zoom}
        onZoomChange={setZoom}
        panX={panX}
        panY={panY}
        onPanChange={(x, y) => { setPanX(x); setPanY(y); }}
        showNewProject={showNewProject}
        setShowNewProject={setShowNewProject}
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        handleBgRemoval={handleBgRemoval}
      />
    );
  }

  return (
    <DesktopLayout 
      state={state}
      zoom={zoom}
      onZoomChange={setZoom}
      panX={panX}
      panY={panY}
      onPanChange={(x, y) => { setPanX(x); setPanY(y); }}
      showNewProject={showNewProject}
      setShowNewProject={setShowNewProject}
      showExportModal={showExportModal}
      setShowExportModal={setShowExportModal}
      handleBgRemoval={handleBgRemoval}
    />
  );
}






