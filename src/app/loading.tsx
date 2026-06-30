'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function Loading() {
  const [shouldShow, setShouldShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 350ms delay: if the page loads faster than this, do not show any loading animation!
    const timer = setTimeout(() => {
      setShouldShow(true);
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!shouldShow || !container) return;

    return () => {
      // This cleanup runs when Next.js unmounts the loading component!
      if (container && container.parentNode) {
        // Clone the element to let it fade out smoothly in the DOM
        const clone = container.cloneNode(true) as HTMLDivElement;
        
        // Ensure it is positioned fixed relative to the viewport so it doesn't shift
        clone.classList.remove('absolute');
        clone.classList.add('fixed');
        clone.classList.add('pointer-events-none');
        
        // Add exit animations to the clone backdrop and inner card
        clone.classList.add('loading-exit-backdrop');
        const inner = clone.firstElementChild as HTMLElement | null;
        if (inner) {
          inner.classList.add('loading-exit-container');
        }
        
        // Append clone to body
        document.body.appendChild(clone);
        
        // Clean up the clone after the animation completes
        setTimeout(() => {
          if (clone.parentNode) {
            clone.parentNode.removeChild(clone);
          }
        }, 300);
      }
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-[40] flex items-center justify-center bg-black/12 dark:bg-black/35 backdrop-blur-[2px] animate-in fade-in duration-300"
    >
      {/* Sleek glassmorphic floating container with curved edges */}
      <div className="px-8 py-5 bg-onyx/90 border border-onyx-border/40 dark:border-white/10 rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_45px_rgba(0,0,0,0.65)] flex flex-col items-center gap-3 w-44 animate-in scale-in duration-200">
        
        {/* Organic 3-Dot scaling wave animation container */}
        <div className="flex gap-2.5 items-center justify-center py-2.5">
          <div className="w-3.5 h-3.5 bg-gradient-to-r from-primary-gold to-[#F2D272] rounded-full organic-dot organic-dot-1 shadow-[0_0_12px_rgba(212,175,55,0.45)]" />
          <div className="w-3.5 h-3.5 bg-gradient-to-r from-primary-gold to-[#F2D272] rounded-full organic-dot organic-dot-2 shadow-[0_0_12px_rgba(212,175,55,0.45)]" />
          <div className="w-3.5 h-3.5 bg-gradient-to-r from-primary-gold to-[#F2D272] rounded-full organic-dot organic-dot-3 shadow-[0_0_12px_rgba(212,175,55,0.45)]" />
        </div>

        {/* Subtitle context */}
        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest animate-pulse">
          Loading...
        </span>
      </div>

      <style>{`
        @keyframes organic-scale {
          0%, 100% {
            transform: scale(0.6);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
        @keyframes fade-out-exit {
          from {
            opacity: 1;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
          }
          to {
            opacity: 0;
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
          }
        }
        @keyframes scale-out-exit {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(0.95);
            opacity: 0;
          }
        }
        .organic-dot {
          animation: organic-scale 1.1s ease-in-out infinite;
        }
        .organic-dot-1 {
          animation-delay: 0s;
        }
        .organic-dot-2 {
          animation-delay: 0.16s;
        }
        .organic-dot-3 {
          animation-delay: 0.32s;
        }
        .loading-exit-backdrop {
          animation: fade-out-exit 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
        .loading-exit-container {
          animation: scale-out-exit 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
      `}</style>
    </div>
  );
}
