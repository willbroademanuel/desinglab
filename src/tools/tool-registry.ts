// ==============================================================================
// TOOL REGISTRY — Single Source of Truth
// ==============================================================================
// This is THE authoritative manifest of every tool in the DesignLab platform.
//
// Rules for adding a new tool:
//   1. Add an entry here
//   2. Create the tool folder under tools/ai-tools/ or tools/utility-tools/
//   3. The hub grid, slug router, and admin panel will pick it up automatically
//
// Credit costs shown here are DISPLAY DEFAULTS only.
// Authoritative costs for AI tools are always read from the `feature_registry`
// table in the database via deductCreditsForFeature(). Never trust these values
// for billing logic — they are for UI hint purposes only.
// ==============================================================================

import {
  Brush,
  Paintbrush,
  Video,
  Camera,
  Filter,
  Layout,
  Palette,
  ScanText,
  Minimize,
  Image as ImageIcon,
  Droplets,
  Scissors,
  Zap,
  Hash,
  MonitorSmartphone,
  Film,
  Type,
} from 'lucide-react';
import type { ToolDefinition } from './types';

// ── AI Tools (Credit-Based) ─────────────────────────────────────────────────

const AI_TOOLS: ToolDefinition[] = [
  {
    slug: 'inpaint',
    displayName: 'AI Inpaint',
    description: 'Erase and replace any part of your photo using AI',
    category: 'ai-tools',
    route: '/dashboard/designer-hub/inpaint',
    creditCost: 2, // display only — DB is authoritative
    featureSlug: 'inpaint',
    icon: Brush,
    isAI: true,
    isFeatured: true,
    status: 'active',
  },
  {
    slug: 'design-lab',
    displayName: 'Design Lab',
    description: 'Full canvas editor: add text, stickers, and effects',
    category: 'ai-tools',
    route: '/dashboard/designer-hub/design-lab',
    creditCost: 0,
    icon: Paintbrush,
    isAI: false, // canvas editor — no AI API call required
    isFeatured: true,
    isCombo: true,
    status: 'active',
  },
  {
    slug: 'photo-background-studio',
    displayName: 'Photo Background Studio',
    displayNameShort: 'BG Studio',
    description: 'Replace or remove photo backgrounds with AI precision',
    category: 'ai-tools',
    route: '/dashboard/designer-hub/photo-background-studio',
    creditCost: 0,
    featureSlug: 'photo-background-studio',
    icon: Video,
    isAI: true,
    isCombo: true,
    status: 'active',
  },
  {
    slug: 'portrait-mode',
    displayName: 'Portrait Mode',
    description: 'Apply cinematic portrait blur and depth effects',
    category: 'ai-tools',
    route: '/dashboard/designer-hub/portrait-mode',
    creditCost: 0,
    featureSlug: 'portrait-mode',
    icon: Camera,
    isAI: true,
    status: 'active',
  },


  {
    slug: 'web-optimizer',
    displayName: 'Web Optimizer',
    description: 'Compress and optimize images for the web automatically',
    category: 'ai-tools',
    route: '/dashboard/designer-hub/web-optimizer',
    creditCost: 0,
    icon: Zap,
    isAI: false,
    isCombo: true,
    status: 'active',
  },
];

// ── Utility Tools (Free / Client-Side) ────────────────────────────────────

const UTILITY_TOOLS: ToolDefinition[] = [
  {
    slug: 'image-filters',
    displayName: 'Image Filters',
    description: 'Apply premium photo filters instantly',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/image-filters',
    creditCost: 0,
    icon: Filter,
    isAI: false,
    status: 'active',
  },
  {
    slug: 'social-resizer',
    displayName: 'Social Resizer',
    description: 'Resize your image for any social platform format',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/social-resizer',
    creditCost: 0,
    icon: Layout,
    isAI: false,
    status: 'active',
  },
  {
    slug: 'palette-extractor',
    displayName: 'Palette Extractor',
    description: 'Extract the color palette from any photo',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/palette-extractor',
    creditCost: 0,
    icon: Palette,
    isAI: false,
    status: 'active',
  },
  {
    slug: 'ocr-extractor',
    displayName: 'OCR Text Extractor',
    description: 'Extract text from any image instantly',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/ocr-extractor',
    creditCost: 0,
    icon: ScanText,
    isAI: false,
    status: 'active',
  },
  {
    slug: 'image-compressor',
    displayName: 'Image Compressor',
    description: 'Reduce file size without visible quality loss',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/image-compressor',
    creditCost: 0,
    icon: Minimize,
    isAI: false,
    status: 'active',
  },
  {
    slug: 'format-converter',
    displayName: 'Format Converter',
    description: 'Convert images between PNG, JPEG, WebP, and more',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/format-converter',
    creditCost: 0,
    icon: ImageIcon,
    isAI: false,
    status: 'active',
  },

  {
    slug: 'image-cropper',
    displayName: 'Image Cropper',
    description: 'Crop and straighten photos with precision',
    category: 'utility-tools',
    route: '/dashboard/designer-hub/image-cropper',
    creditCost: 0,
    icon: Scissors,
    isAI: false,
    status: 'active',
  },
];

// ── Top-Level AI Feature Routes (separate URLs for SEO/marketing) ──────────

/**
 * These tools have top-level /dashboard/* routes for marketing/SEO reasons,
 * but their implementation lives in tools/ai-tools/*.
 * They are NOT listed in the designer-hub grid — they have their own nav links.
 */
export const TOP_LEVEL_AI_ROUTES: ToolDefinition[] = [
  {
    slug: 'text-to-image',
    displayName: 'Text to Photo',
    description: 'Generate stunning photos from a text description',
    category: 'ai-tools',
    route: '/dashboard/text-to-image',
    creditCost: 2,
    featureSlug: 'text-to-image',
    icon: Type,
    isAI: true,
    status: 'active',
  },
  {
    slug: 'photo-video',
    displayName: 'Photo to Video',
    description: 'Animate your photos into cinematic video clips',
    category: 'ai-tools',
    route: '/dashboard/photo-video',
    creditCost: 12,
    featureSlug: 'photo-video',
    icon: Film,
    isAI: true,
    status: 'active',
  },
];

// ── Build the Registry ─────────────────────────────────────────────────────

const ALL_HUB_TOOLS: ToolDefinition[] = [...AI_TOOLS, ...UTILITY_TOOLS];

/**
 * The complete tool registry. Keys are tool slugs.
 * O(1) lookup for any tool by slug.
 */
export const toolRegistry = new Map<string, ToolDefinition>(
  [...ALL_HUB_TOOLS, ...TOP_LEVEL_AI_ROUTES].map((tool) => [tool.slug, tool])
);

// ── Registry Query Helpers ─────────────────────────────────────────────────

/**
 * Get a single tool by its slug.
 * Returns undefined if the slug is not registered.
 */
export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return toolRegistry.get(slug);
}

/**
 * Get all tools belonging to a category.
 */
export function getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
  return ALL_HUB_TOOLS.filter((t) => t.category === category);
}

/**
 * Get all tools shown in the designer hub grid (excludes top-level routes).
 * Preserves the ordering defined in AI_TOOLS and UTILITY_TOOLS above.
 */
export function getHubTools(): ToolDefinition[] {
  return ALL_HUB_TOOLS;
}

/**
 * Get all active AI tools shown in the designer hub grid.
 */
export function getActiveHubTools(): ToolDefinition[] {
  return ALL_HUB_TOOLS.filter((t) => t.status === 'active');
}
