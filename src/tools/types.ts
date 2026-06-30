// ==============================================================================
// TOOLS DOMAIN — Shared Type Definitions
// ==============================================================================
// Every tool in this codebase must conform to these interfaces.
// These types are the contract between the tool-registry and the routing layer.
// ==============================================================================

import type { LucideIcon } from 'lucide-react';

// ── Tool Categories ────────────────────────────────────────────────────────────

export type ToolCategory =
  | 'ai-tools'       // Credit-based AI-powered tools (call external AI APIs)
  | 'utility-tools'; // Free client-side utility tools (no credit cost)

// ── Tool Status ─────────────────────────────────────────────────────────────

export type ToolStatus =
  | 'active'
  | 'coming-soon'
  | 'beta'
  | 'deprecated';

// ── Core Tool Definition ────────────────────────────────────────────────────

/**
 * The canonical definition of a tool in the Pixtrend platform.
 * This is the single source of truth used by:
 *   - DesignerHubClient (to render the tools grid)
 *   - [slug]/page.tsx (to resolve which component to load)
 *   - Admin panel (to manage tool visibility and pricing)
 */
export interface ToolDefinition {
  /** Unique URL-safe identifier. Used as route slug and feature_registry key. */
  slug: string;

  /** Human-readable display name */
  displayName: string;

  /** Short description shown on tool cards */
  description: string;

  /** Domain category — determines folder location and credit logic */
  category: ToolCategory;

  /** Full route path (e.g. '/dashboard/designer-hub/inpaint') */
  route: string;

  /**
   * Credit cost. 0 = free tool.
   * For AI tools, this is a default display value only —
   * the authoritative cost is always read from feature_registry in the DB.
   */
  creditCost: number;

  /** Lucide icon component for this tool */
  icon: LucideIcon;

  /** Whether this tool is AI-powered (calls external AI APIs) */
  isAI: boolean;

  /** Whether this tool is highlighted as trending/featured on the hub */
  isFeatured?: boolean;

  /** Tools with 'combo' flag render with a special badge on the hub grid */
  isCombo?: boolean;

  /** Current availability status */
  status: ToolStatus;

  /**
   * The feature_registry slug used for credit deduction.
   * Only required for AI tools (isAI: true).
   * Must exactly match the `slug` column in the feature_registry table.
   */
  featureSlug?: string;

  /**
   * Optional short display name for mobile-constrained layouts.
   * Falls back to displayName if not provided.
   */
  displayNameShort?: string;
}

// ── Tool Registry Shape ──────────────────────────────────────────────────────

/** The complete tool registry map, keyed by slug for O(1) lookup */
export type ToolRegistry = Map<string, ToolDefinition>;

// ── Tool Component Contract ─────────────────────────────────────────────────

/**
 * Every tool's default export must be a React component
 * that accepts no required props (page-level data fetching is done in page.tsx).
 * Tools that need server data receive it via server component page.tsx wrappers.
 */
export type ToolComponent = React.ComponentType<Record<string, never>>;
