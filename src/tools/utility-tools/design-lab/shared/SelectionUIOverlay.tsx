import React from 'react';
import type { DesignLabState } from '../useDesignLab';
import type { Layer } from '../types';

interface SelectionUIOverlayProps {
  state: DesignLabState;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  cssScale: number;
  hoveredId: string | null;
}

export default function SelectionUIOverlay({
  state, zoom, canvasWidth, canvasHeight, cssScale, hoveredId
}: SelectionUIOverlayProps) {
  const { project, activeLayerId, editingLayerId, selectedLayerIds } = state;

  // The base scale factor to keep things 1px on screen, then multiply by desired screen pixels
  const screenScale = 1 / (cssScale * zoom);

  return (
    <svg
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      className="absolute inset-0 w-full h-full pointer-events-none z-40"
      style={{ overflow: 'visible' }}
    >
      {/* 1. Hover Outlines */}
      {hoveredId && !selectedLayerIds.includes(hoveredId) && hoveredId !== editingLayerId && (
        (() => {
          const layer = project.layers.find((l: Layer) => l.id === hoveredId);
          const box = state.hitBoxes.current[hoveredId];
          if (!layer || layer.locked || !box) return null;

          const pad = 4 * screenScale;
          const left = -box.w / 2 - pad;
          const top = -box.h / 2 - pad;
          const bw = box.w + pad * 2;
          const bh = box.h + pad * 2;

          return (
            <g transform={`translate(${layer.x}, ${layer.y}) rotate(${layer.rotation})`}>
              <rect
                x={left} y={top} width={bw} height={bh}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2 * screenScale}
              />
            </g>
          );
        })()
      )}

      {/* 2. Super Bounding Box for Multi-Selection */}
      {selectedLayerIds.length > 1 && (
        (() => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let found = false;

          for (const id of selectedLayerIds) {
            const box = state.hitBoxes.current[id];
            if (box) {
              const layer = project.layers.find((l: Layer) => l.id === id);
              if (layer) {
                minX = Math.min(minX, layer.x + box.x);
                minY = Math.min(minY, layer.y + box.y);
                maxX = Math.max(maxX, layer.x + box.x + box.w);
                maxY = Math.max(maxY, layer.y + box.y + box.h);
                found = true;
              }
            }
          }

          if (!found) return null;

          const handleSize = 6 * screenScale;

          return (
            <g>
              <rect
                x={minX} y={minY} width={maxX - minX} height={maxY - minY}
                fill="none" stroke="#3b82f6" strokeWidth={1 * screenScale}
                strokeDasharray={`${4 * screenScale},${4 * screenScale}`}
              />
              {[
                [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]
              ].map(([hx, hy], i) => (
                <rect
                  key={i}
                  x={hx - handleSize / 2} y={hy - handleSize / 2}
                  width={handleSize} height={handleSize}
                  fill="#ffffff" stroke="#3b82f6" strokeWidth={1 * screenScale}
                />
              ))}
            </g>
          );
        })()
      )}

      {/* 3. Active Layer Selection Box */}
      {selectedLayerIds.length === 1 && activeLayerId && (
        (() => {
          const layer = project.layers.find((l: Layer) => l.id === activeLayerId);
          const box = state.hitBoxes.current[activeLayerId];
          if (!layer || !box) return null;

          const isEditing = layer.id === editingLayerId;
          const isLocked = layer.locked;

          const pad = 4 * screenScale;
          const left = -box.w / 2 - pad;
          const top = -box.h / 2 - pad;
          const bw = box.w + pad * 2;
          const bh = box.h + pad * 2;

          return (
            <g transform={`translate(${layer.x}, ${layer.y}) rotate(${layer.rotation})`}>
              {/* Box Outline */}
              <rect
                x={left} y={top} width={bw} height={bh}
                fill="none"
                stroke={isEditing ? '#eab308' : (isLocked ? '#94a3b8' : '#3b82f6')}
                strokeWidth={(isEditing ? 2 : 3) * screenScale}
                strokeDasharray={isEditing ? `${5 * screenScale},${5 * screenScale}` : undefined}
              />

              {/* Handles */}
              {!isLocked && !isEditing && (
                <>
                  {/* 4 Corners (Scale) */}
                  {[
                    [left, top], [left + bw, top], [left, top + bh], [left + bw, top + bh]
                  ].map(([cx, cy], i) => (
                    <circle
                      key={i} cx={cx} cy={cy} r={7 * screenScale}
                      fill="#3b82f6" stroke="#ffffff" strokeWidth={2 * screenScale}
                      style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
                    />
                  ))}

                  {/* Pills (Width/Height Resize) */}
                  {(layer.type === 'text' || layer.type === 'shape') && (
                    <>
                      {/* Left and Right */}
                      {(box.h / screenScale > 40) && (
                        <>
                          <rect
                            x={left - (7 * screenScale)} y={top + bh / 2 - (16 * screenScale)}
                        width={14 * screenScale} height={32 * screenScale} rx={4 * screenScale}
                        fill="#3b82f6" stroke="#ffffff" strokeWidth={2 * screenScale}
                        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
                      />
                      <rect
                        x={left + bw - (7 * screenScale)} y={top + bh / 2 - (16 * screenScale)}
                        width={14 * screenScale} height={32 * screenScale} rx={4 * screenScale}
                        fill="#3b82f6" stroke="#ffffff" strokeWidth={2 * screenScale}
                        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
                      />
                        </>
                      )}
                      {/* Top and Bottom (Shapes only) */}
                      {layer.type === 'shape' && (box.w / screenScale > 40) && (
                        <>
                          <rect
                            x={left + bw / 2 - (16 * screenScale)} y={top - (7 * screenScale)}
                            width={32 * screenScale} height={14 * screenScale} rx={4 * screenScale}
                            fill="#3b82f6" stroke="#ffffff" strokeWidth={2 * screenScale}
                            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
                          />
                          <rect
                            x={left + bw / 2 - (16 * screenScale)} y={top + bh - (7 * screenScale)}
                            width={32 * screenScale} height={14 * screenScale} rx={4 * screenScale}
                            fill="#3b82f6" stroke="#ffffff" strokeWidth={2 * screenScale}
                            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* Bottom Controls */}
                  {(() => {
                    const isSmall = (box.w / screenScale < 80) || (box.h / screenScale < 80);
                    if (isSmall) {
                      return (
                        <g transform={`translate(${left + bw / 2}, ${top + bh + (45 * screenScale)})`}>
                          <g transform={`translate(${-(22 * screenScale)}, 0)`}>
                            <circle cx={0} cy={0} r={16 * screenScale} fill="#3b82f6" stroke="#ffffff" strokeWidth={2.5 * screenScale} style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }} />
                            <g transform={`scale(${0.8 * screenScale}) translate(-12, -12)`} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                            </g>
                          </g>
                          <g transform={`translate(${22 * screenScale}, 0)`}>
                            <circle cx={0} cy={0} r={16 * screenScale} fill="#ffffff" stroke="#3b82f6" strokeWidth={2.5 * screenScale} style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }} />
                            <g transform={`scale(${0.75 * screenScale}) translate(-12, -12)`} stroke="#3b82f6" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="5 9 2 12 5 15" />
                              <polyline points="9 5 12 2 15 5" />
                              <polyline points="19 9 22 12 19 15" />
                              <polyline points="9 19 12 22 15 19" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <line x1="12" y1="2" x2="12" y2="22" />
                            </g>
                          </g>
                        </g>
                      );
                    } else {
                      return (
                        <g transform={`translate(${left + bw / 2}, ${top + bh + (45 * screenScale)})`}>
                          <line x1={0} y1={-(45 * screenScale)} x2={0} y2={-(18 * screenScale)} stroke="#3b82f6" strokeWidth={3 * screenScale} />
                          <circle cx={0} cy={0} r={18 * screenScale} fill="#3b82f6" stroke="#ffffff" strokeWidth={2.5 * screenScale} style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }} />
                          <g transform={`scale(${0.9 * screenScale}) translate(-12, -12)`} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </g>
                        </g>
                      );
                    }
                  })()}
                </>
              )}
            </g>
          );
        })()
      )}
    </svg>
  );
}
