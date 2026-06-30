'use client';

// ==============================================================================
// DESIGNLAB — Inline Text Editor Overlay (Enterprise Edition)
// Rendered over the canvas when a text layer is being edited.
// Mirrors all new text properties: fontWeight, textTransform, textDecoration, padding.
// IMPORTANT: Curved text (curveAmount !== 0) cannot be edited inline — the overlay
// is suppressed and a notification is shown instead.
// ==============================================================================

import React, { useRef, useEffect } from 'react';
import type { TextLayer } from '../types';
import type { DesignLabState } from '../useDesignLab';

interface TextOverlayProps {
  state: DesignLabState;
  canvasEl: HTMLCanvasElement | null;
}

export default function TextOverlay({ state, canvasEl }: TextOverlayProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const layer = state.activeLayer;

  useEffect(() => {
    if (state.editingLayerId && textAreaRef.current) {
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
          const len = textAreaRef.current.value.length;
          textAreaRef.current.setSelectionRange(len, len);
        }
      }, 10);
    }
  }, [state.editingLayerId]);

  const textLayer = layer?.type === 'text' ? (layer as TextLayer) : null;
  const canvas = canvasEl;

  // SAFE DEFAULT: Protect against division by zero if canvasWidth is somehow 0 or missing
  const canvasWidth = state.projectRef.current?.canvasWidth || 1080;
  const cssScale = (canvas && canvasWidth > 0) ? canvas.clientWidth / canvasWidth : 1;

  // Auto-expand textarea height instantaneously as user types
  useEffect(() => {
    const el = textAreaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;

      // FIX: Force width expansion for auto-width text
      if (!textLayer?.width) {
        el.style.width = '0px';
        el.style.width = `${el.scrollWidth}px`;
      }
    }
  }, [textLayer?.text, cssScale, state.editingLayerId, textLayer?.width]);

  if (!state.editingLayerId || !layer || layer.type !== 'text' || !canvas) return null;

  const activeTextLayer = textLayer as TextLayer;
  const curveAmount = activeTextLayer.curveAmount ?? 0;

  // ── Curved text cannot be edited inline ──
  // Clicking a curved text layer opens editing mode but shows a flat notification
  // instead of the textarea, since we cannot curve a <textarea> element.
  if (curveAmount !== 0) {
    const hitBox = state.hitBoxes.current[activeTextLayer.id];
    if (!hitBox) return null;

    const centerX = (activeTextLayer.x * cssScale);
    const centerY = (activeTextLayer.y * cssScale);

    return (
      <div className="absolute overflow-visible pointer-events-none z-50" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
        <div
          className="absolute pointer-events-auto bg-[color:var(--surface-1)] border border-primary-gold/50 rounded-xl px-4 py-3 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${centerX}px`,
            top: `${centerY}px`,
            transform: 'translate(-50%, -120%)',
            zIndex: 50,
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-[color:var(--text-primary)] mb-1">Curved Text</p>
          <p className="text-[10px] text-[color:var(--text-tertiary)] max-w-[200px]">
            Set Curve to 0° in Properties to edit inline, or double-click to type here.
          </p>
          {/* Inline edit fallback textarea (straight mode) */}
          <textarea
            className="mt-2 w-full min-h-[50px] bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-lg p-2 text-xs text-[color:var(--text-primary)] resize-none outline-none focus:border-primary-gold"
            value={activeTextLayer.text}
            onChange={e => {
              try {
                state.updateLayer(layer.id, { text: e.target.value } as any, false);
              } catch (err) {
                console.error('[DesignLab] Failed to update curved text layer:', err);
              }
            }}
            onBlur={() => {
              state.setEditingLayerId(null);
              state.pushHistory();
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                state.setEditingLayerId(null);
                state.pushHistory();
              }
            }}
          />
        </div>
      </div>
    );
  }

  // ── Standard inline textarea for straight text ──

  const fontSize    = activeTextLayer.fontSize || 20;
  const lineHeight  = activeTextLayer.lineHeight || 1.2;
  const textContent = activeTextLayer.text || '';
  const lineCount   = textContent.split('\n').length;
  const fallbackHeight = lineCount * fontSize * lineHeight * cssScale;

  // Safe defaults for new fields
  const fontWeight    = activeTextLayer.fontWeight ?? (activeTextLayer.isBold ? 700 : 400);
  const textTransform = activeTextLayer.textTransform ?? 'none';
  const textDecoration = activeTextLayer.textDecoration ?? 'none';
  const padding       = activeTextLayer.padding ?? 12;

  const EXTRA_PADDING = Math.max(padding, 12) * cssScale; // Scale padding with zoom

  return (
    <div className="absolute overflow-visible pointer-events-none z-50" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
      <textarea
        ref={textAreaRef}
        value={textContent}
        onChange={(e) => {
          try {
            state.updateLayer(layer.id, { text: e.target.value } as any, false);
          } catch (err) {
            console.error('[DesignLab] Failed to update text layer:', err);
          }
        }}
        onFocus={() => {
          // MOBILE VIEWPORT FIX: Prevent Safari from aggressively scrolling
          const x = window.scrollX;
          const y = window.scrollY;
          window.scrollTo(x, y);
          setTimeout(() => window.scrollTo(x, y), 10);
        }}
        onBlur={() => {
          state.setEditingLayerId(null);
          state.pushHistory();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            state.setEditingLayerId(null);
            state.pushHistory();
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute z-50 bg-transparent border-0 outline-none resize-none overflow-hidden pointer-events-auto"
        style={{
          left: `${activeTextLayer.x * cssScale}px`,
          top: `${activeTextLayer.y * cssScale}px`,
          transform: `translate(-50%, -50%) rotate(${activeTextLayer.rotation || 0}deg)`,
          transformOrigin: '50% 50%',
          width: activeTextLayer.width ? `${activeTextLayer.width * cssScale}px` : 'max-content',
          maxWidth: 'none',
          minHeight: `${fallbackHeight + EXTRA_PADDING * 2}px`,
          padding: `${EXTRA_PADDING}px`,
          margin: 0,
          boxSizing: 'border-box',
          whiteSpace: activeTextLayer.width ? 'pre-wrap' : 'pre',
          wordWrap: activeTextLayer.width ? 'break-word' : 'normal',
          wordBreak: 'normal',
          color: activeTextLayer.color,
          fontFamily: `"${activeTextLayer.fontFamily}", sans-serif`,
          // Enterprise: use fontWeight (not just bold/normal)
          fontWeight: fontWeight,
          fontStyle: activeTextLayer.isItalic ? 'italic' : 'normal',
          fontSize: `${activeTextLayer.fontSize * cssScale}px`,
          lineHeight: `${activeTextLayer.lineHeight}`,
          textAlign: activeTextLayer.textAlign as React.CSSProperties['textAlign'],
          letterSpacing: activeTextLayer.letterSpacing > 0 ? `${activeTextLayer.letterSpacing * cssScale}px` : 'normal',
          // Enterprise: text transform + decoration
          textTransform: textTransform as React.CSSProperties['textTransform'],
          textDecoration: textDecoration === 'none' ? undefined : textDecoration,
          WebkitTextStroke: activeTextLayer.strokeWidth > 0
            ? `${activeTextLayer.strokeWidth * cssScale}px ${activeTextLayer.strokeColor}`
            : 'none',
          textShadow: activeTextLayer.shadow
            ? `${activeTextLayer.shadow.x * cssScale}px ${activeTextLayer.shadow.y * cssScale}px ${activeTextLayer.shadow.blur * cssScale}px ${activeTextLayer.shadow.color}`
            : 'none',
        }}
      />
    </div>
  );
}
