// ==============================================================================
// TOOLS DOMAIN — Public Barrel Export
// ==============================================================================
// This is the public API surface of the tools/ domain.
// Import from '@tools' for registry queries.
// Import from '@tools/ai-tools/{slug}' or '@tools/utility-tools/{slug}'
// for the actual tool UI components and server actions.
// ==============================================================================

export {
  toolRegistry,
  getToolBySlug,
  getToolsByCategory,
  getHubTools,
  getActiveHubTools,
  TOP_LEVEL_AI_ROUTES,
} from './tool-registry';

export type { ToolDefinition, ToolCategory, ToolStatus, ToolRegistry, ToolComponent } from './types';
