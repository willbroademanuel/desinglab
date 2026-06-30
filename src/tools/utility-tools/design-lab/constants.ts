// ==============================================================================
// DESIGNLAB — Constants & Presets
// Fonts, canvas sizes, color palettes, shape definitions
// ==============================================================================

import type { CanvasPreset } from './types';

// ===== Google Fonts (loaded on-demand via CSS @import) =====
// Grouped: Display → Sans → Serif → Script → Mono → Fun

export const FONT_LIST: { name: string; category: string }[] = [
  // Display & Poster
  { name: 'Impact', category: 'Display' },
  { name: 'Bebas Neue', category: 'Display' },
  { name: 'Anton', category: 'Display' },
  { name: 'Oswald', category: 'Display' },
  { name: 'Archivo Black', category: 'Display' },
  { name: 'Russo One', category: 'Display' },
  { name: 'Righteous', category: 'Display' },
  { name: 'Bangers', category: 'Display' },
  { name: 'Bungee', category: 'Display' },
  { name: 'Black Ops One', category: 'Display' },
  // Sans-Serif (Modern)
  { name: 'Inter', category: 'Sans' },
  { name: 'Roboto', category: 'Sans' },
  { name: 'Poppins', category: 'Sans' },
  { name: 'Montserrat', category: 'Sans' },
  { name: 'Outfit', category: 'Sans' },
  { name: 'Lato', category: 'Sans' },
  { name: 'Raleway', category: 'Sans' },
  { name: 'Open Sans', category: 'Sans' },
  { name: 'Nunito', category: 'Sans' },
  { name: 'Kanit', category: 'Sans' },
  // Serif (Elegant)
  { name: 'Playfair Display', category: 'Serif' },
  { name: 'Merriweather', category: 'Serif' },
  { name: 'Lora', category: 'Serif' },
  { name: 'Times New Roman', category: 'Serif' },
  // Script & Handwriting
  { name: 'Dancing Script', category: 'Script' },
  { name: 'Pacifico', category: 'Script' },
  { name: 'Lobster', category: 'Script' },
  { name: 'Permanent Marker', category: 'Script' },
  { name: 'Caveat', category: 'Script' },
  // Mono & Pixel
  { name: 'Courier New', category: 'Mono' },
  { name: 'Press Start 2P', category: 'Mono' },
  // System fallbacks
  { name: 'Arial', category: 'System' },
  { name: 'Verdana', category: 'System' },
  { name: 'Comic Sans MS', category: 'System' },
];

// System fonts that don't need loading from Google
export const SYSTEM_FONTS = new Set([
  'Impact', 'Arial', 'Verdana', 'Comic Sans MS',
  'Times New Roman', 'Courier New',
]);

// ===== Canvas Presets =====

export const CANVAS_PRESETS: CanvasPreset[] = [
  // Social Media
  { name: 'Instagram Post', width: 1080, height: 1080, category: 'social' },
  { name: 'Instagram Story', width: 1080, height: 1920, category: 'social' },
  { name: 'Facebook Post', width: 1200, height: 630, category: 'social' },
  { name: 'Facebook Cover', width: 820, height: 312, category: 'social' },
  { name: 'Twitter/X Post', width: 1600, height: 900, category: 'social' },
  { name: 'Twitter/X Header', width: 1500, height: 500, category: 'social' },
  { name: 'LinkedIn Post', width: 1200, height: 627, category: 'social' },
  { name: 'Pinterest Pin', width: 1000, height: 1500, category: 'social' },
  { name: 'TikTok Video', width: 1080, height: 1920, category: 'social' },
  { name: 'WhatsApp Status', width: 1080, height: 1920, category: 'social' },
  // Video
  { name: 'YouTube Thumbnail', width: 1280, height: 720, category: 'video' },
  { name: 'YouTube Banner', width: 2560, height: 1440, category: 'video' },
  { name: 'Full HD (1080p)', width: 1920, height: 1080, category: 'video' },
  { name: '4K UHD', width: 3840, height: 2160, category: 'video' },
  // Print
  { name: 'A4 Portrait', width: 2480, height: 3508, category: 'print' },
  { name: 'A4 Landscape', width: 3508, height: 2480, category: 'print' },
  { name: 'A5 Portrait', width: 1748, height: 2480, category: 'print' },
  { name: 'Letter Portrait', width: 2550, height: 3300, category: 'print' },
  { name: 'Business Card', width: 1050, height: 600, category: 'print' },
  { name: 'Poster 18×24', width: 2700, height: 3600, category: 'print' },
  { name: 'Flyer (A5)', width: 1748, height: 2480, category: 'print' },
];

// ===== Color Palettes =====

export const FILL_COLORS = [
  '#FFFFFF', '#000000', '#F8FAFC', '#1E293B',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4',
  '#14B8A6', '#F43F5E', '#D946EF', '#6366F1',
  '#0EA5E9', '#10B981', '#FCD34D', '#9333EA',
];

export const BG_SOLID_COLORS = [
  '#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0',
  '#000000', '#0F172A', '#1E293B', '#334155',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4',
];

export const BG_GRADIENTS = [
  { name: 'Sunset', c1: '#FF512F', c2: '#DD2476' },
  { name: 'Ocean', c1: '#2193b0', c2: '#6dd5ed' },
  { name: 'Cyberpunk', c1: '#ff00cc', c2: '#333399' },
  { name: 'Forest', c1: '#11998e', c2: '#38ef7d' },
  { name: 'Night', c1: '#2c3e50', c2: '#3498db' },
  { name: 'Peach', c1: '#ed4264', c2: '#ffedbc' },
  { name: 'Lava', c1: '#fc4a1a', c2: '#f7b733' },
  { name: 'Grape', c1: '#8A2387', c2: '#E94057' },
  { name: 'Mint', c1: '#00b09b', c2: '#96c93d' },
  { name: 'Aurora', c1: '#00C9FF', c2: '#92FE9D' },
  { name: 'Rose', c1: '#ee9ca7', c2: '#ffdde1' },
  { name: 'Midnight', c1: '#0f0c29', c2: '#302b63' },
];

// ===== Limits =====

export const MAX_CANVAS_DIM_DESKTOP = 4096;
export const MAX_CANVAS_DIM_MOBILE = 2048;
export const MAX_HISTORY_SIZE = 50;
export const DB_PERSIST_DEBOUNCE_MS = 600;
export const DB_KEY_PROJECT = 'designlab-project';
export const DB_KEY_LEGACY = 'meme-workspace'; // migration key
export const SNAP_THRESHOLD = 6; // px snap distance for alignment guides
export const MIN_LAYER_SIZE = 20; // minimum width/height for shapes
export const MAX_FILE_SIZE_MB = 20;
