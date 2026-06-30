'use client';

// ==============================================================================
// useTool — Shared Tool State Hook
// ==============================================================================
// Generic hook used by utility tools (free, client-side) to manage:
//   - Processing state
//   - Per-tool result history (persisted to IndexedDB)
//   - Storage availability detection (graceful degradation in incognito)
//
// AI tools typically manage their own state via tool-specific hooks,
// but they may use this for history persistence.
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  saveResult,
  getResultsByTool,
  deleteResult,
  type ToolResult,
  initToolsDB,
} from '@/lib/indexeddb/workspace-db';

export interface UseToolReturn {
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  history: (ToolResult & { previewUrl?: string })[];
  save: (blob?: Blob, metadata?: Record<string, unknown>) => Promise<boolean>;
  removeHistoryItem: (id: string) => Promise<void>;
  /** false when running in incognito or a browser that blocks IndexedDB */
  isStorageAvailable: boolean;
}

export function useTool(toolName: string): UseToolReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<(ToolResult & { previewUrl?: string })[]>([]);
  const [isStorageAvailable, setIsStorageAvailable] = useState<boolean>(true);

  const loadHistory = useCallback(async () => {
    const db = await initToolsDB();
    if (!db) {
      setIsStorageAvailable(false);
      return;
    }

    setIsStorageAvailable(true);
    const results = await getResultsByTool(toolName);

    // Create object URLs for preview rendering.
    // These are revoked on unmount to prevent memory leaks.
    const resultsWithUrls = results.map((item) => ({
      ...item,
      previewUrl: item.blob ? URL.createObjectURL(item.blob) : undefined,
    }));

    setHistory(resultsWithUrls);
  }, [toolName]);

  useEffect(() => {
    loadHistory();

    // Revoke all object URLs when component unmounts
    return () => {
      setHistory((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
    };
  }, [loadHistory]);

  const save = async (blob?: Blob, metadata?: Record<string, unknown>): Promise<boolean> => {
    if (!isStorageAvailable) return false;

    setIsProcessing(true);
    try {
      const id = await saveResult(toolName, blob, metadata);
      if (id) {
        await loadHistory(); // Reload to reflect new entry
        return true;
      }
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const removeHistoryItem = async (id: string): Promise<void> => {
    if (!isStorageAvailable) return;

    const success = await deleteResult(id);
    if (success) {
      setHistory((prev) => {
        const item = prev.find((i) => i.id === id);
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((i) => i.id !== id);
      });
    }
  };

  return {
    isProcessing,
    setIsProcessing,
    history,
    save,
    removeHistoryItem,
    isStorageAvailable,
  };
}
