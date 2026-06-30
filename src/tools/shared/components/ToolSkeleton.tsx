import React from 'react';

/**
 * Generic loading skeleton for all tools.
 * Shown while the tool component lazy-loads via React.lazy().
 */
export function ToolSkeleton() {
  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6 animate-pulse">
      <div className="h-8 bg-[color:var(--surface-3)] rounded w-1/4"></div>
      <div className="h-4 bg-[color:var(--surface-2)] rounded w-2/4"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="h-96 bg-[color:var(--surface-2)] rounded-lg border border-[color:var(--border-subtle)]"></div>
        <div className="space-y-4">
          <div className="h-10 bg-[color:var(--surface-2)] rounded-xl w-full"></div>
          <div className="h-40 bg-[color:var(--surface-2)] rounded-xl w-full"></div>
          <div className="h-12 bg-primary-gold/20 rounded-xl w-full mt-8"></div>
        </div>
      </div>
    </div>
  );
}
