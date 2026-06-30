'use client';

// ==============================================================================
// DESIGNLAB — FontPicker Component
// A professional, virtualized font picker with search, category tabs,
// weight selection, and IntersectionObserver-based lazy font preview loading.
// Shared between DesktopSidebar and MobileSidebar.
// ==============================================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, AlertTriangle, Check } from 'lucide-react';
import { FONT_LIST, FONT_WEIGHT_LABELS, SYSTEM_FONTS } from '../constants';
import { loadGoogleFont, loadGoogleFontAsync, isFontReady } from '../utils';

type FontCategory = 'All' | 'Display' | 'Sans' | 'Serif' | 'Script' | 'Condensed' | 'Slab' | 'Mono' | 'Creative' | 'System';

const CATEGORIES: FontCategory[] = ['All', 'Display', 'Sans', 'Serif', 'Script', 'Condensed', 'Slab', 'Mono', 'Creative', 'System'];

interface FontPickerProps {
  /** Currently selected font family name */
  currentFont: string;
  /** Currently selected font weight */
  currentWeight?: number;
  /** Called when user selects a new font */
  onFontChange: (fontName: string) => void;
  /** Called when user selects a new weight */
  onWeightChange?: (weight: number) => void;
  /** Maximum height of the scrollable font list */
  maxHeight?: number;
}

// ───────────────────────────────────────────────────────────────────────────────
// FontListItem — renders a single font with lazy-loaded preview text
// ───────────────────────────────────────────────────────────────────────────────

interface FontListItemProps {
  name: string;
  category: string;
  weights: number[];
  isActive: boolean;
  onSelect: (name: string) => void;
}

function FontListItem({ name, category, weights, isActive, onSelect }: FontListItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(() => isFontReady(name, 400) || SYSTEM_FONTS.has(name));
  const [loadFailed, setLoadFailed] = useState(false);

  // Use IntersectionObserver to load font preview only when the item scrolls into view.
  // This prevents loading all 120 fonts upfront.
  useEffect(() => {
    if (isPreviewLoaded || SYSTEM_FONTS.has(name)) return;

    const el = itemRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          loadGoogleFontAsync(name, 400, false)
            .then(() => setIsPreviewLoaded(true))
            .catch(() => {
              setLoadFailed(true);
              setIsPreviewLoaded(true); // Still show text, just in fallback font
            });
        }
      },
      { rootMargin: '100px' } // Pre-load 100px before coming into view
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [name, isPreviewLoaded]);

  return (
    <button
      ref={itemRef}
      onClick={() => onSelect(name)}
      role="option"
      aria-selected={isActive}
      className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors rounded-md group ${
        isActive
          ? 'bg-primary-gold/15 text-primary-gold'
          : 'hover:bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]'
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Preview text rendered in the actual font */}
        <span
          className="text-base leading-tight truncate"
          style={{
            fontFamily: isPreviewLoaded ? `"${name}", sans-serif` : 'inherit',
            transition: 'font-family 0.15s ease',
          }}
        >
          {name}
        </span>
        <span className="text-[9px] text-[color:var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1">
          {category}
          {loadFailed && (
            <span title="Font unavailable offline" className="text-amber-400">
              <AlertTriangle className="w-2.5 h-2.5 inline" />
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Loading shimmer */}
        {!isPreviewLoaded && !loadFailed && (
          <div className="w-8 h-2 bg-[color:var(--border-subtle)] rounded animate-pulse" />
        )}
        {isActive && <Check className="w-3.5 h-3.5 text-primary-gold shrink-0" />}
      </div>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// FontWeightPicker — shows only weights available for the selected font
// ───────────────────────────────────────────────────────────────────────────────

interface FontWeightPickerProps {
  fontName: string;
  currentWeight: number;
  onWeightChange: (weight: number) => void;
}

function FontWeightPicker({ fontName, currentWeight, onWeightChange }: FontWeightPickerProps) {
  const fontEntry = FONT_LIST.find(f => f.name === fontName);
  const availableWeights = fontEntry?.weights ?? [400];

  if (availableWeights.length <= 1) return null; // Don't show picker for single-weight fonts

  return (
    <div className="px-3 pb-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] mb-1.5">Weight</p>
      <div className="flex flex-wrap gap-1">
        {availableWeights.map(w => {
          const label = FONT_WEIGHT_LABELS[w] ?? String(w);
          const isActive = w === currentWeight;
          return (
            <button
              key={w}
              onClick={() => {
                onWeightChange(w);
                // Pre-load this weight in the background
                loadGoogleFont(fontName, w);
              }}
              title={label}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${
                isActive
                  ? 'bg-primary-gold text-black border-primary-gold'
                  : 'bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] hover:border-primary-gold hover:text-primary-gold'
              }`}
              style={{
                fontFamily: `"${fontName}", sans-serif`,
                fontWeight: w,
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// FontPicker — main exported component
// ───────────────────────────────────────────────────────────────────────────────

export default function FontPicker({
  currentFont,
  currentWeight = 400,
  onFontChange,
  onWeightChange,
  maxHeight = 260,
}: FontPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FontCategory>('All');
  const listRef = useRef<HTMLDivElement>(null);

  // Stable filtered list — recomputed only when search or category changes
  const filteredFonts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return FONT_LIST.filter(f => {
      const matchesSearch = !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  // Scroll selected font into view when the picker opens
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[aria-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentFont]);

  // Keyboard navigation within the font list
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const options = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      if (!options || options.length === 0) return;
      const activeIdx = Array.from(options).findIndex(el => el.getAttribute('aria-selected') === 'true');
      const nextIdx = e.key === 'ArrowDown'
        ? Math.min(activeIdx + 1, options.length - 1)
        : Math.max(activeIdx - 1, 0);
      options[nextIdx]?.focus();
    }
  }, []);

  const currentFontEntry = FONT_LIST.find(f => f.name === currentFont);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-tertiary)] pointer-events-none" />
        <input
          type="text"
          placeholder="Search fonts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search fonts"
          aria-busy={false}
          className="w-full pl-8 pr-3 py-2 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-lg text-xs outline-none focus:border-primary-gold transition-colors placeholder:text-[color:var(--text-tertiary)]"
        />
      </div>

      {/* ── Category tabs ── */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hidden pb-0.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
              activeCategory === cat
                ? 'bg-primary-gold text-black border-primary-gold'
                : 'bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] text-[color:var(--text-tertiary)] hover:border-primary-gold'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Font list ── */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Font family"
        className="overflow-y-auto border border-[color:var(--border-subtle)] rounded-lg bg-[color:var(--surface-1)] scrollbar-hidden"
        style={{ maxHeight }}
      >
        {filteredFonts.length === 0 ? (
          <p className="text-[11px] text-[color:var(--text-tertiary)] text-center py-6">
            No fonts found for "{searchQuery}"
          </p>
        ) : (
          <div className="p-1 space-y-0.5">
            {filteredFonts.map(f => (
              <FontListItem
                key={f.name}
                name={f.name}
                category={f.category}
                weights={f.weights ?? [400]}
                isActive={currentFont === f.name}
                onSelect={(name) => {
                  onFontChange(name);
                  // Immediately pre-load the selected font at the current weight
                  loadGoogleFont(name, currentWeight);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Font weight picker (shown when a font is selected) ── */}
      {onWeightChange && currentFontEntry && (currentFontEntry.weights?.length ?? 1) > 1 && (
        <FontWeightPicker
          fontName={currentFont}
          currentWeight={currentWeight}
          onWeightChange={onWeightChange}
        />
      )}

      {/* ── Result count ── */}
      <p className="text-[9px] text-[color:var(--text-tertiary)] text-right">
        {filteredFonts.length} font{filteredFonts.length !== 1 ? 's' : ''}
        {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
      </p>
    </div>
  );
}
