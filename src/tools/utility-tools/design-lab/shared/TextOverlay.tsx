'use client';

// ==============================================================================
// DESIGNLAB — Inline Text Editor Overlay (Canva-style)
// Rendered over the canvas when a text layer is being edited
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

  // Auto-expand textarea height instantaneously as user types to prevent cropping
  useEffect(() => {
    const el = textAreaRef.current;
    if (el) {
      el.style.height = '0px'; // Reset first to get correct scrollHeight if it shrinks
      el.style.height = `${el.scrollHeight}px`; 

      // FIX: Force width expansion for auto-width text to bypass browser containment caps.
      // Browsers often cap 'max-content' on absolute textareas to the containing block (canvas size),
      // causing text to visually clip at the canvas edge. This explicit pixel sizing fixes it.
      if (!textLayer?.width) {
        el.style.width = '0px';
        el.style.width = `${el.scrollWidth}px`;
      }
    }
  }, [textLayer?.text, cssScale, state.editingLayerId, textLayer?.width]);

  if (!state.editingLayerId || !layer || layer.type !== 'text' || !canvas) return null;

  const hitBox = state.hitBoxes.current[layer.id];
  const activeTextLayer = textLayer as TextLayer;
  
  // SAFE DEFAULT: Provide fallback values in case text layer metrics are corrupted
  const fontSize = activeTextLayer.fontSize || 20;
  const lineHeight = activeTextLayer.lineHeight || 1.2;
  const textContent = activeTextLayer.text || '';
  
  const lineCount = textContent.split('\n').length;
  const fallbackHeight = lineCount * fontSize * lineHeight * cssScale;

  const EXTRA_PADDING = 12; // FIX: Extra padding to prevent italic or stroked text from cropping at the edges

  return (
    // FIX: Removed 'inset-0' and 'overflow-hidden' to prevent the parent div from prematurely bounding the textarea to the screen width.
    <div className="absolute overflow-visible pointer-events-none z-50" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
      <textarea
        ref={textAreaRef}
        value={textContent}
        onChange={(e) => {
          // ERROR HANDLING: Catch potential state update failures to prevent full editor crashes
          try {
            state.updateLayer(layer.id, { text: e.target.value } as any, false);
          } catch (err) {
            console.error('[DesignLab] Failed to update text layer:', err);
          }
        }}
        onFocus={() => {
          // MOBILE VIEWPORT FIX: Prevent Safari from aggressively scrolling the page to align the absolute input
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
          // FIX: Use 50% for vertical transform and origin to ensure the text remains perfectly centered 
          // around layer.y even when it wraps to multiple lines, and account for the extra padding.
          transform: `translate(-50%, -50%) rotate(${activeTextLayer.rotation || 0}deg)`,
          transformOrigin: `50% 50%`,
          // FIX: The bounding box now handles internal padding on the canvas side. 
          // Match the HTML textarea perfectly to the canvas bounding box width.
          width: activeTextLayer.width ? `${activeTextLayer.width * cssScale}px` : 'max-content',
          // FIX: Align the HTML maxWidth perfectly with the Canvas engine's Infinity rule
          maxWidth: 'none',
          minHeight: `${fallbackHeight + EXTRA_PADDING * 2}px`,
          padding: `${EXTRA_PADDING}px`,
          margin: 0,
          boxSizing: 'border-box',
          // FIX: For auto-width text (no explicit width), force 'pre' to prevent the browser
          // from wrapping the text when it hits the edge of the viewport.
          whiteSpace: activeTextLayer.width ? 'pre-wrap' : 'pre',
          wordWrap: activeTextLayer.width ? 'break-word' : 'normal',
          wordBreak: 'normal',
          color: activeTextLayer.color,
          fontFamily: `"${activeTextLayer.fontFamily}", sans-serif`,
          fontWeight: activeTextLayer.isBold ? 'bold' : 'normal',
          fontStyle: activeTextLayer.isItalic ? 'italic' : 'normal',
          fontSize: `${activeTextLayer.fontSize * cssScale}px`,
          lineHeight: `${activeTextLayer.lineHeight}`,
          textAlign: activeTextLayer.textAlign as React.CSSProperties['textAlign'],
          letterSpacing: activeTextLayer.letterSpacing > 0 ? `${activeTextLayer.letterSpacing * cssScale}px` : 'normal',
          WebkitTextStroke: activeTextLayer.strokeWidth > 0 ? `${activeTextLayer.strokeWidth * cssScale}px ${activeTextLayer.strokeColor}` : 'none',
          textShadow: activeTextLayer.shadow 
            ? `${activeTextLayer.shadow.x * cssScale}px ${activeTextLayer.shadow.y * cssScale}px ${activeTextLayer.shadow.blur * cssScale}px ${activeTextLayer.shadow.color}` 
            : 'none',
        }}
      />
    </div>
  );
}
