'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Download, Loader2, ImageIcon, Film,
  ChevronLeft, ChevronRight, Share2, Maximize2,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useDownloadHandler } from './useDownloadHandler';

/* ══════════════════════════════════════════════════════════════
   MEDIA PREVIEW MODAL
   ──────────────────────────────────────────────────────────────
   A unified, portal-rendered modal for previewing images AND
   videos. Supports single-item or gallery-mode (multi-item with
   keyboard/swipe navigation).

   Features:
   • Portal rendering (escapes stacking contexts)
   • Body scroll lock with proper cleanup
   • Escape / click-outside to close
   • Arrow-key + swipe navigation for multi-item
   • Download with progress states
   • Share (copy URL)
   • Video autoplay, controls, resource cleanup
   • Accessible: role="dialog", aria-modal, focus trap
   • Theme-aware via CSS custom properties
   • SSR safe (portal guarded by mount check)
   ══════════════════════════════════════════════════════════════ */

export interface MediaPreviewItem {
  url: string;
  type: 'image' | 'video';
  label?: string;
  downloadName?: string;
}

export interface MediaPreviewModalProps {
  /** Single item or array of items (gallery mode). */
  items: MediaPreviewItem[];
  /** Starting index when in gallery mode. Defaults to 0. */
  initialIndex?: number;
  /** Called when the modal requests to close. */
  onClose: () => void;
}

/* ── Detect media type from URL if not explicitly provided ────── */
function inferMediaType(url: string): 'image' | 'video' {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('video')) {
    return 'video';
  }
  return 'image';
}

/* ── Animation keyframes (injected once) ─────────────────────── */
const KEYFRAMES_ID = 'media-preview-modal-keyframes';

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes mpm-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes mpm-content-in {
      from { opacity: 0; transform: scale(0.92) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes mpm-fade-out {
      from { opacity: 1; transform: scale(1); }
      to   { opacity: 0; transform: scale(0.95); }
    }
  `;
  document.head.appendChild(style);
}

/* ── Main component ──────────────────────────────────────────── */
export default function MediaPreviewModal({
  items,
  initialIndex = 0,
  onClose,
}: MediaPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [mediaVisible, setMediaVisible] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const { trigger, getState, abort } = useDownloadHandler();
  const { t } = useTranslation();

  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const fadeTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Normalise items — ensure type is set
  const normalisedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        type: item.type || inferMediaType(item.url),
      })),
    [items]
  );

  const currentItem = normalisedItems[currentIndex];
  const isMulti = normalisedItems.length > 1;
  const isVideo = currentItem?.type === 'video';
  const dlState = getState('modal-dl');

  // ── SSR guard ──────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    ensureKeyframes();
  }, []);

  // ── Reset states when navigating to a new item ─────────────
  useEffect(() => {
    // Immediately hide the media (fade out)
    setMediaVisible(false);
    setLoading(true);
    setMediaError(false);
  }, [currentIndex]);

  // ── Body scroll lock ───────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Focus trap: focus the modal on mount ───────────────────
  useEffect(() => {
    const el = modalRef.current;
    if (el) {
      el.focus();
    }
  }, [mounted]);

  // ── Keyboard handler ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (isMulti) {
            e.preventDefault();
            setCurrentIndex((i) => (i > 0 ? i - 1 : normalisedItems.length - 1));
          }
          break;
        case 'ArrowRight':
          if (isMulti) {
            e.preventDefault();
            setCurrentIndex((i) => (i < normalisedItems.length - 1 ? i + 1 : 0));
          }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, isMulti, normalisedItems.length]);

  // ── Cleanup: abort downloads + clear video on unmount ──────
  useEffect(() => {
    return () => {
      abort();
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [abort]);

  // ── Pause and release video resources on close / index change
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load(); // release network resources
      }
    };
  }, [currentIndex]);

  // ── Touch handlers (swipe to navigate / dismiss) ───────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      touchStartRef.current = null;

      // Horizontal swipe threshold: 60px, must be primarily horizontal
      if (absDx > 60 && absDx > absDy * 1.5) {
        if (isMulti) {
          if (dx > 0) {
            setCurrentIndex((i) => (i > 0 ? i - 1 : normalisedItems.length - 1));
          } else {
            setCurrentIndex((i) => (i < normalisedItems.length - 1 ? i + 1 : 0));
          }
        }
        return;
      }

      // Vertical swipe down to dismiss (threshold: 80px)
      if (dy > 80 && absDy > absDx * 1.5) {
        onClose();
      }
    },
    [isMulti, normalisedItems.length, onClose]
  );

  // ── Share / copy URL ───────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!currentItem?.url) return;
    try {
      await navigator.clipboard.writeText(currentItem.url);
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[MediaPreview] Failed to copy URL:', err);
      // Fallback: open in new tab
      window.open(currentItem.url, '_blank', 'noopener,noreferrer');
    }
  }, [currentItem]);

  // ── Download handler ───────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!currentItem?.url) return;
    const name = currentItem.downloadName || `designlab-${isVideo ? 'video' : 'image'}-${Date.now()}`;
    trigger(currentItem.url, name, isVideo, 'modal-dl');
  }, [currentItem, isVideo, trigger]);

  // ── Don't render until client-side mount ───────────────────
  if (!mounted || !currentItem) return null;

  // ── Label badge styling ────────────────────────────────────
  const labelText = currentItem.label || (isVideo ? 'Video' : 'Image');
  const isAIResult =
    labelText === 'AI Result' ||
    labelText === 'Matokeo ya AI' ||
    labelText.toLowerCase().includes('ai');

  return createPortal(
    <div
      ref={modalRef}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${labelText}`}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[color:var(--surface-1)]/90 backdrop-blur-2xl"
        style={{ animation: 'mpm-backdrop-in 0.2s ease-out both' }}
      />

      {/* Content container */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 w-full max-w-[min(92vw,720px)] max-h-[92dvh]"
        style={{ animation: 'mpm-content-in 0.25s ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                ${isAIResult
                  ? 'bg-primary-gold/20 text-primary-gold border border-primary-gold/30'
                  : 'bg-[color:var(--surface-2)] text-[color:var(--text-secondary)] border border-[color:var(--border-default)]'
                }
              `}
            >
              {isVideo ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              {labelText}
            </span>

            {/* Counter badge for gallery mode */}
            {isMulti && (
              <span className="text-xs text-[color:var(--text-tertiary)] font-medium tabular-nums">
                {currentIndex + 1} / {normalisedItems.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[color:var(--surface-2)] hover:bg-[color:var(--surface-3)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] backdrop-blur-sm border border-[color:var(--border-default)] transition-all duration-200 active:scale-90"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Media display ────────────────────────────────── */}
        <div
          ref={mediaContainerRef}
          className="relative w-full rounded-2xl overflow-hidden border border-[color:var(--border-default)] bg-[color:var(--surface-1)] shadow-2xl"
          style={{
            height: containerHeight ? `${containerHeight}px` : 'auto',
            minHeight: loading && !containerHeight ? '280px' : undefined,
            transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Loading spinner */}
          {loading && !mediaError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--surface-1)]/60 z-10">
              <Loader2 className="w-8 h-8 text-primary-gold animate-spin" />
            </div>
          )}

          {/* Error state */}
          {mediaError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
              {isVideo ? (
                <Film className="w-10 h-10" />
              ) : (
                <ImageIcon className="w-10 h-10" />
              )}
              <p className="text-sm">{t('preview.loadFailed')}</p>
              <button
                type="button"
                onClick={() => {
                  setMediaError(false);
                  setLoading(true);
                }}
                className="text-xs text-primary-gold hover:text-primary-gold/80 underline transition-colors"
              >
                Retry
              </button>
            </div>
          ) : isVideo ? (
            /* Video player */
            <video
              ref={videoRef}
              key={currentItem.url}
              src={currentItem.url}
              controls
              autoPlay
              loop
              playsInline
              className={`w-full max-h-[62dvh] object-contain transition-opacity duration-200 ease-out ${mediaVisible ? 'opacity-100' : 'opacity-0'}`}
              onLoadedData={(e) => {
                const el = e.currentTarget;
                // Measure the rendered height after the browser lays it out
                requestAnimationFrame(() => {
                  const rect = el.getBoundingClientRect();
                  if (rect.height > 0) setContainerHeight(rect.height);
                  setLoading(false);
                  // Delay fade-in so the container height transition plays first
                  if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
                  fadeTimerRef.current = setTimeout(() => setMediaVisible(true), 80);
                });
              }}
              onError={() => {
                setMediaError(true);
                setLoading(false);
              }}
            />
          ) : (
            /* Image */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={currentItem.url}
              src={currentItem.url}
              alt={labelText}
              className={`w-full max-h-[62dvh] object-contain transition-opacity duration-200 ease-out ${mediaVisible ? 'opacity-100' : 'opacity-0'}`}
              onLoad={(e) => {
                const el = e.currentTarget;
                // Measure the rendered height after the browser lays it out
                requestAnimationFrame(() => {
                  const rect = el.getBoundingClientRect();
                  if (rect.height > 0) setContainerHeight(rect.height);
                  setLoading(false);
                  // Delay fade-in so the container height transition plays first
                  if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
                  fadeTimerRef.current = setTimeout(() => setMediaVisible(true), 80);
                });
              }}
              onError={() => {
                setMediaError(true);
                setLoading(false);
              }}
              draggable={false}
            />
          )}

          {/* ── Gallery navigation arrows (multi-item only) ── */}
          {isMulti && !mediaError && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((i) => (i > 0 ? i - 1 : normalisedItems.length - 1));
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[color:var(--surface-2)]/50 hover:bg-[color:var(--surface-2)]/80 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] backdrop-blur-sm border border-[color:var(--border-default)] transition-all duration-200 active:scale-90 z-20"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((i) => (i < normalisedItems.length - 1 ? i + 1 : 0));
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[color:var(--surface-2)]/50 hover:bg-[color:var(--surface-2)]/80 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] backdrop-blur-sm border border-[color:var(--border-default)] transition-all duration-200 active:scale-90 z-20"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* ── Action buttons ───────────────────────────────── */}
        <div className="w-full flex gap-2">
          {/* Download button */}
          <button
            type="button"
            disabled={dlState === 'downloading'}
            onClick={handleDownload}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
              transition-all duration-200 select-none
              active:scale-[0.97] active:brightness-90
              disabled:cursor-wait
              ${dlState === 'done'
                ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)]'
                : 'bg-gradient-to-r from-[#e8c84e] via-[#d4af37] to-[#c49b25] text-black shadow-[0_4px_20px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_28px_rgba(212,175,55,0.45)] hover:brightness-110'
              }
            `}
          >
            {dlState === 'downloading' ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                {t('preview.downloading')}
              </>
            ) : dlState === 'done' ? (
              <>
                <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('preview.downloaded')}
              </>
            ) : (
              <>
                <Download className="w-4.5 h-4.5" />
                {t('preview.downloadMedia')}
              </>
            )}
          </button>

          {/* Share / Copy URL button */}
          <button
            type="button"
            onClick={handleShare}
            className={`w-14 flex items-center justify-center rounded-xl border transition-all duration-200 active:scale-95
              ${copied
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-[color:var(--surface-2)] border border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-3)] hover:text-[color:var(--text-primary)]'
              }
            `}
            title={copied ? String(t('preview.copied')) : String(t('preview.share'))}
          >
            {copied ? (
              <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <Share2 className="w-4.5 h-4.5" />
            )}
          </button>
        </div>

        {/* ── Dot indicators for gallery mode ────────────── */}
        {isMulti && (
          <div className="w-full flex items-center justify-center gap-2 pt-2">
            {normalisedItems.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to item ${idx + 1}`}
                className="p-0.5 transition-all duration-300 ease-out"
              >
                <div
                  className={`rounded-full transition-all duration-300 ease-out
                    ${idx === currentIndex
                      ? 'w-3 h-3 bg-primary-gold shadow-[0_0_10px_rgba(212,175,55,0.6)] scale-125'
                      : 'w-2 h-2 bg-[color:var(--border-strong)] hover:bg-[color:var(--text-tertiary)] scale-100'
                    }
                  `}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Re-export convenience types and hook ─────────────────────── */
export { useDownloadHandler } from './useDownloadHandler';
export type { DownloadState } from './useDownloadHandler';
