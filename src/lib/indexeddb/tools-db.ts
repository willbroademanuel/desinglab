// ==============================================================================
// BACKWARD COMPATIBILITY RE-EXPORT
// ==============================================================================
// The original import path '@/lib/indexeddb/tools-db' is preserved here
// so existing code that hasn't migrated yet continues to work.
//
// New code should import from '@/lib/indexeddb/workspace-db' directly.
// This file will be removed in a future cleanup pass.
// ==============================================================================

export {
  // Tool result history
  initDB,
  initToolsDB,
  saveResult,
  getResultsByTool,
  getAllResults,
  deleteResult,
  clearAllResults,
  type ToolResult,
  // Workspace state
  setItem,
  getItem,
  removeItem,
  clearAll,
} from './workspace-db';
