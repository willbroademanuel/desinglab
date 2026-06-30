// ==============================================================================
// DESIGNLAB — Constants & Presets
// Fonts, canvas sizes, color palettes, shape definitions
// ==============================================================================

import type { CanvasPreset } from './types';

// ===== Google Fonts Library =====
// ~120 curated, high-quality fonts. Each entry includes:
//   name     — exact Google Fonts family name
//   category — grouping label for the FontPicker tabs
//   weights  — numeric weights available in Google Fonts for this family
//              (undefined = only 400 available; lazy fallback for system fonts)
//
// Load strategy:
//   - Top 10 "featured" fonts are batch-preloaded on app start at weight 400.
//   - All others are lazy-loaded on demand when selected or when they scroll
//     into view in the FontPicker (via IntersectionObserver).

export const FONT_LIST: { name: string; category: string; weights?: number[]; featured?: boolean }[] = [
  // ── Display & Poster ──
  { name: 'Bebas Neue',      category: 'Display', weights: [400], featured: true },
  { name: 'Anton',           category: 'Display', weights: [400] },
  { name: 'Oswald',          category: 'Display', weights: [200, 300, 400, 500, 600, 700], featured: true },
  { name: 'Archivo Black',   category: 'Display', weights: [400] },
  { name: 'Russo One',       category: 'Display', weights: [400] },
  { name: 'Righteous',       category: 'Display', weights: [400] },
  { name: 'Bangers',         category: 'Display', weights: [400] },
  { name: 'Bungee',          category: 'Display', weights: [400] },
  { name: 'Black Ops One',   category: 'Display', weights: [400] },
  { name: 'Alfa Slab One',   category: 'Display', weights: [400] },
  { name: 'Boogaloo',        category: 'Display', weights: [400] },
  { name: 'Fredoka One',     category: 'Display', weights: [400] },
  { name: 'Lilita One',      category: 'Display', weights: [400] },
  { name: 'Passion One',     category: 'Display', weights: [400, 700, 900] },
  { name: 'Squada One',      category: 'Display', weights: [400] },
  { name: 'Titan One',       category: 'Display', weights: [400] },
  { name: 'Ultra',           category: 'Display', weights: [400] },
  { name: 'Big Shoulders Display', category: 'Display', weights: [100,200,300,400,500,600,700,800,900] },

  // ── Sans-Serif (Modern) ──
  { name: 'Inter',           category: 'Sans', weights: [100,200,300,400,500,600,700,800,900], featured: true },
  { name: 'Roboto',          category: 'Sans', weights: [100,300,400,500,700,900] },
  { name: 'Poppins',         category: 'Sans', weights: [100,200,300,400,500,600,700,800,900], featured: true },
  { name: 'Montserrat',      category: 'Sans', weights: [100,200,300,400,500,600,700,800,900], featured: true },
  { name: 'Outfit',          category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Lato',            category: 'Sans', weights: [100,300,400,700,900] },
  { name: 'Raleway',         category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Open Sans',       category: 'Sans', weights: [300,400,500,600,700,800] },
  { name: 'Nunito',          category: 'Sans', weights: [200,300,400,500,600,700,800,900] },
  { name: 'Kanit',           category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'DM Sans',         category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Manrope',         category: 'Sans', weights: [200,300,400,500,600,700,800] },
  { name: 'Plus Jakarta Sans', category: 'Sans', weights: [200,300,400,500,600,700,800] },
  { name: 'Figtree',         category: 'Sans', weights: [300,400,500,600,700,800,900] },
  { name: 'Geist',           category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Syne',            category: 'Sans', weights: [400,500,600,700,800] },
  { name: 'Space Grotesk',   category: 'Sans', weights: [300,400,500,600,700] },
  { name: 'Barlow',          category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Noto Sans',       category: 'Sans', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Source Sans 3',   category: 'Sans', weights: [200,300,400,500,600,700,800,900] },
  { name: 'Rubik',           category: 'Sans', weights: [300,400,500,600,700,800,900] },

  // ── Serif (Elegant) ──
  { name: 'Playfair Display', category: 'Serif', weights: [400,500,600,700,800,900], featured: true },
  { name: 'Merriweather',    category: 'Serif', weights: [300,400,700,900] },
  { name: 'Lora',            category: 'Serif', weights: [400,500,600,700] },
  { name: 'EB Garamond',     category: 'Serif', weights: [400,500,600,700,800] },
  { name: 'Cormorant Garamond', category: 'Serif', weights: [300,400,500,600,700] },
  { name: 'DM Serif Display', category: 'Serif', weights: [400] },
  { name: 'Libre Baskerville', category: 'Serif', weights: [400,700] },
  { name: 'Crimson Text',    category: 'Serif', weights: [400,600,700] },
  { name: 'Josefin Slab',    category: 'Serif', weights: [100,200,300,400,500,600,700] },
  { name: 'Bodoni Moda',     category: 'Serif', weights: [400,500,600,700,800,900] },
  { name: 'Spectral',        category: 'Serif', weights: [200,300,400,500,600,700,800] },

  // ── Script & Handwriting ──
  { name: 'Pacifico',        category: 'Script', weights: [400], featured: true },
  { name: 'Dancing Script',  category: 'Script', weights: [400,500,600,700] },
  { name: 'Lobster',         category: 'Script', weights: [400] },
  { name: 'Permanent Marker', category: 'Script', weights: [400] },
  { name: 'Caveat',          category: 'Script', weights: [400,500,600,700] },
  { name: 'Sacramento',      category: 'Script', weights: [400] },
  { name: 'Great Vibes',     category: 'Script', weights: [400] },
  { name: 'Satisfy',         category: 'Script', weights: [400] },
  { name: 'Allura',          category: 'Script', weights: [400] },
  { name: 'Alex Brush',      category: 'Script', weights: [400] },
  { name: 'Parisienne',      category: 'Script', weights: [400] },
  { name: 'Italiana',        category: 'Script', weights: [400] },
  { name: 'Pinyon Script',   category: 'Script', weights: [400] },
  { name: 'Kaushan Script',  category: 'Script', weights: [400] },
  { name: 'Courgette',       category: 'Script', weights: [400] },
  { name: 'Cookie',          category: 'Script', weights: [400] },

  // ── Condensed / Narrow ──
  { name: 'Barlow Condensed', category: 'Condensed', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Oswald',          category: 'Condensed', weights: [200,300,400,500,600,700] },
  { name: 'Roboto Condensed', category: 'Condensed', weights: [100,200,300,400,500,600,700,800,900] },
  { name: 'Yanone Kaffeesatz', category: 'Condensed', weights: [200,300,400,500,600,700] },
  { name: 'Fjalla One',      category: 'Condensed', weights: [400] },

  // ── Slab Serif ──
  { name: 'Rockwell',        category: 'Slab', weights: [400, 700] },
  { name: 'Zilla Slab',      category: 'Slab', weights: [300,400,500,600,700] },
  { name: 'Crete Round',     category: 'Slab', weights: [400] },
  { name: 'Arvo',            category: 'Slab', weights: [400,700] },
  { name: 'Rokkitt',         category: 'Slab', weights: [100,200,300,400,500,600,700,800,900] },

  // ── Mono & Pixel ──
  { name: 'Fira Code',       category: 'Mono', weights: [300,400,500,600,700] },
  { name: 'JetBrains Mono',  category: 'Mono', weights: [100,200,300,400,500,600,700,800] },
  { name: 'Space Mono',      category: 'Mono', weights: [400,700] },
  { name: 'Roboto Mono',     category: 'Mono', weights: [100,200,300,400,500,600,700] },
  { name: 'Press Start 2P',  category: 'Mono', weights: [400] },
  { name: 'VT323',           category: 'Mono', weights: [400] },
  { name: 'Share Tech Mono', category: 'Mono', weights: [400] },

  // ── Fun & Creative ──
  { name: 'Fredericka the Great', category: 'Creative', weights: [400] },
  { name: 'Abril Fatface',   category: 'Creative', weights: [400] },
  { name: 'Boogaloo',        category: 'Creative', weights: [400] },
  { name: 'Comfortaa',       category: 'Creative', weights: [300,400,500,600,700] },
  { name: 'Baloo 2',         category: 'Creative', weights: [400,500,600,700,800] },
  { name: 'Chewy',           category: 'Creative', weights: [400] },
  { name: 'Bubblegum Sans',  category: 'Creative', weights: [400] },
  { name: 'Shrikhand',       category: 'Creative', weights: [400] },

  // ── System Fonts (no Google Fonts load needed) ──
  { name: 'Impact',          category: 'System' },
  { name: 'Arial',           category: 'System' },
  { name: 'Verdana',         category: 'System' },
  { name: 'Times New Roman', category: 'System', weights: [400, 700] },
  { name: 'Courier New',     category: 'System' },
  { name: 'Georgia',         category: 'System', weights: [400, 700] },
  { name: 'Trebuchet MS',    category: 'System', weights: [400, 700] },
  { name: 'Comic Sans MS',   category: 'System' },
];

/** Fonts that do NOT need to be loaded from Google (available in every OS). */
export const SYSTEM_FONTS = new Set([
  'Impact', 'Arial', 'Verdana', 'Comic Sans MS',
  'Times New Roman', 'Courier New', 'Georgia', 'Trebuchet MS',
]);

/** Top featured fonts pre-loaded at app start (weight 400 only). */
export const FEATURED_FONTS = FONT_LIST.filter(f => f.featured).map(f => f.name);

// ===== Font Weight Labels =====

export const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

// ===== Text Style Presets =====
// fontSize is a multiplier of canvas height (resolved at layer-creation time).

export const TEXT_STYLE_PRESETS: {
  label: string;
  fontSizeRatio: number;  // × canvasHeight
  fontWeight: number;
  letterSpacing: number;
  fontFamily: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}[] = [
  {
    label: 'Heading',
    fontSizeRatio: 0.10,
    fontWeight: 800,
    letterSpacing: -1,
    fontFamily: 'Montserrat',
    textTransform: 'uppercase',
  },
  {
    label: 'Subheading',
    fontSizeRatio: 0.06,
    fontWeight: 600,
    letterSpacing: 0,
    fontFamily: 'Poppins',
    textTransform: 'none',
  },
  {
    label: 'Body',
    fontSizeRatio: 0.04,
    fontWeight: 400,
    letterSpacing: 0,
    fontFamily: 'Inter',
    textTransform: 'none',
  },
  {
    label: 'Caption',
    fontSizeRatio: 0.025,
    fontWeight: 300,
    letterSpacing: 2,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
  },
];

// ===== Canvas Presets =====

export const CANVAS_PRESETS: CanvasPreset[] = [
  // Social Media
  { name: 'Instagram Post',   width: 1080, height: 1080, category: 'social' },
  { name: 'Instagram Story',  width: 1080, height: 1920, category: 'social' },
  { name: 'Facebook Post',    width: 1200, height: 630,  category: 'social' },
  { name: 'Facebook Cover',   width: 820,  height: 312,  category: 'social' },
  { name: 'Twitter/X Post',   width: 1600, height: 900,  category: 'social' },
  { name: 'Twitter/X Header', width: 1500, height: 500,  category: 'social' },
  { name: 'LinkedIn Post',    width: 1200, height: 627,  category: 'social' },
  { name: 'Pinterest Pin',    width: 1000, height: 1500, category: 'social' },
  { name: 'TikTok Video',     width: 1080, height: 1920, category: 'social' },
  { name: 'WhatsApp Status',  width: 1080, height: 1920, category: 'social' },
  // Video
  { name: 'YouTube Thumbnail', width: 1280, height: 720,  category: 'video' },
  { name: 'YouTube Banner',    width: 2560, height: 1440, category: 'video' },
  { name: 'Full HD (1080p)',   width: 1920, height: 1080, category: 'video' },
  { name: '4K UHD',            width: 3840, height: 2160, category: 'video' },
  // Print
  { name: 'A4 Portrait',      width: 2480, height: 3508, category: 'print' },
  { name: 'A4 Landscape',     width: 3508, height: 2480, category: 'print' },
  { name: 'A5 Portrait',      width: 1748, height: 2480, category: 'print' },
  { name: 'Letter Portrait',  width: 2550, height: 3300, category: 'print' },
  { name: 'Business Card',    width: 1050, height: 600,  category: 'print' },
  { name: 'Poster 18×24',     width: 2700, height: 3600, category: 'print' },
  { name: 'Flyer (A5)',       width: 1748, height: 2480, category: 'print' },
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
  { name: 'Sunset',    c1: '#FF512F', c2: '#DD2476' },
  { name: 'Ocean',     c1: '#2193b0', c2: '#6dd5ed' },
  { name: 'Cyberpunk', c1: '#ff00cc', c2: '#333399' },
  { name: 'Forest',    c1: '#11998e', c2: '#38ef7d' },
  { name: 'Night',     c1: '#2c3e50', c2: '#3498db' },
  { name: 'Peach',     c1: '#ed4264', c2: '#ffedbc' },
  { name: 'Lava',      c1: '#fc4a1a', c2: '#f7b733' },
  { name: 'Grape',     c1: '#8A2387', c2: '#E94057' },
  { name: 'Mint',      c1: '#00b09b', c2: '#96c93d' },
  { name: 'Aurora',    c1: '#00C9FF', c2: '#92FE9D' },
  { name: 'Rose',      c1: '#ee9ca7', c2: '#ffdde1' },
  { name: 'Midnight',  c1: '#0f0c29', c2: '#302b63' },
];

// ===== Limits =====

export const MAX_CANVAS_DIM_DESKTOP = 4096;
export const MAX_CANVAS_DIM_MOBILE  = 2048;
export const MAX_HISTORY_SIZE       = 50;
export const DB_PERSIST_DEBOUNCE_MS = 600;
export const DB_KEY_PROJECT         = 'designlab-project';
export const DB_KEY_LEGACY          = 'meme-workspace'; // migration key
export const SNAP_THRESHOLD         = 6;   // px snap distance for alignment guides
export const MIN_LAYER_SIZE         = 20;  // minimum width/height for shapes
export const MAX_FILE_SIZE_MB       = 20;
export const FONT_LOAD_TIMEOUT_MS   = 5000; // ms before a Google Fonts request is abandoned
export const FONT_REQUEST_DEBOUNCE_MS = 300; // ms debounce on rapid font switching
