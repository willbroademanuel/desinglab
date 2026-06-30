import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { DesignLabState } from '../useDesignLab';

// --- Custom Hooks ---

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- Types ---

interface AssetBrowserProps {
  state: DesignLabState;
  onAssetAdded?: () => void;
}

interface Asset {
  id: string;
  source: 'pixabay' | 'pexels';
  previewUrl: string;
  largeUrl: string;
  author: string;
  authorUrl?: string;
}

interface CacheEntry {
  assets: Asset[];
  page: number;
  hasMore: boolean;
}

// --- Component ---

export default function AssetBrowser({ state, onAssetAdded }: AssetBrowserProps) {
  // State
  const [query, setQuery] = useState('technology');
  const debouncedQuery = useDebounce(query, 500);
  const [assetType, setAssetType] = useState<'all' | 'photo' | 'graphic'>('all');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Fetch logic
  const fetchAssets = useCallback(async (
    searchQuery: string, 
    type: 'all' | 'photo' | 'graphic', 
    pageNum: number,
    isLoadMore: boolean = false
  ) => {
    if (!searchQuery.trim()) return;

    const cacheKey = `${searchQuery.toLowerCase()}_${type}`;
    
    // Check Cache for initial load
    if (!isLoadMore && pageNum === 1) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setAssets(cached.assets);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setError(null);
        setPageError(null);
        return; // Use cached data
      }
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isLoadMore) {
      setLoadingMore(true);
      setPageError(null);
    } else {
      setLoading(true);
      setError(null);
      setAssets([]); // Clear immediately or keep old? Clear for distinct searches
    }

    try {
      // Security: ensure encoding
      const res = await fetch(
        `/api/assets?query=${encodeURIComponent(searchQuery)}&source=both&type=${encodeURIComponent(type)}&page=${pageNum}`,
        { signal: abortControllerRef.current.signal }
      );
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch assets');
      }
      
      const newAssets: Asset[] = data.data || [];
      const receivedHasMore = newAssets.length > 0; // Simple heuristic

      setAssets(prev => {
        const combined = pageNum === 1 
          ? newAssets 
          : [...prev, ...newAssets.filter(a => !prev.some(p => p.id === a.id))];
        
        // Update Cache
        cacheRef.current.set(cacheKey, {
          assets: combined,
          page: pageNum,
          hasMore: receivedHasMore
        });
        
        return combined;
      });
      
      setHasMore(receivedHasMore);
      setPage(pageNum);
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Asset API Partial Failures:', data.errors);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Ignore aborts
      
      const errMsg = err.message || 'An error occurred while fetching assets.';
      if (isLoadMore) {
        setPageError(errMsg);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Effect: Debounced Search & Filter changes
  useEffect(() => {
    // Only trigger if we have a query
    if (debouncedQuery.trim()) {
      fetchAssets(debouncedQuery, assetType, 1, false);
    } else {
      setAssets([]);
      setHasMore(false);
    }
  }, [debouncedQuery, assetType, fetchAssets]);

  // Infinite Scroll Intersection Observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading && !loadingMore && !pageError) {
      fetchAssets(debouncedQuery, assetType, page + 1, true);
    }
  }, [hasMore, loading, loadingMore, pageError, page, debouncedQuery, assetType, fetchAssets]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "200px",
      threshold: 0
    };
    
    observerRef.current = new IntersectionObserver(handleObserver, option);
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [handleObserver, assets.length]); // Rebind observer if needed, or keeping it stable is better? stable is better.
  
  // Handlers
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query !== debouncedQuery) {
      // Force fetch immediately if user hits Enter before debounce finishes
      fetchAssets(query, assetType, 1, false);
    }
  };

  const addImageToCanvas = async (asset: Asset) => {
    onAssetAdded?.();
    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
             if (blob) {
                const file = new File([blob], `${asset.id}.png`, { type: 'image/png' });
                state.addImageLayer(file);
             } else {
                alert('Failed to process image data.');
             }
          });
        }
      } catch (err) {
        console.error("Canvas export error:", err);
        alert('Failed to process image due to security restrictions.');
      }
    };
    img.onerror = () => {
      alert('Failed to load image securely. CORS policy may be blocking it or the image is broken.');
    };
    img.src = asset.largeUrl;
  };

  return (
    <div className="space-y-3 h-full flex flex-col">
      <form onSubmit={handleSearchSubmit} className="flex gap-2 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search free stock photos..."
            aria-label="Search free stock photos"
            className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-primary-gold transition-colors"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-tertiary)]" />
        </div>
      </form>

      {/* Smart Filters */}
      <div className="flex bg-[color:var(--surface-2)] rounded-lg p-1 border border-[color:var(--border-subtle)] shrink-0" role="group" aria-label="Asset filters">
        {(['all', 'photo', 'graphic'] as const).map(type => (
          <button
            key={type}
            onClick={() => setAssetType(type)}
            aria-pressed={assetType === type}
            className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all rounded ${
              assetType === type
                ? 'bg-[color:var(--surface-1)] text-primary-gold shadow-sm'
                : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-1)]/50'
            }`}
          >
            {type === 'graphic' ? 'PNGs' : type}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-500 shrink-0" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-1 relative">
        {loading ? (
          <div className="columns-2 gap-1 space-y-1 p-1" aria-busy="true" aria-label="Loading assets">
             {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full bg-[color:var(--surface-1)] animate-pulse rounded inline-block" style={{ height: `${Math.floor(Math.random() * 100) + 100}px`, marginBottom: '4px' }} />
             ))}
          </div>
        ) : assets.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4 text-[color:var(--text-tertiary)]">
            <Search className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs font-medium">No assets found for "{debouncedQuery}"</p>
            <p className="text-[10px] mt-1 opacity-70">Try a different search term</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-4 pb-2">
            <div className="columns-2 gap-1 space-y-1" role="list">
              {assets.map((asset) => (
                <div 
                  key={asset.id} 
                  className="relative group rounded overflow-hidden cursor-pointer mb-1 inline-block w-full bg-[color:var(--surface-1)] focus-within:ring-2 focus-within:ring-primary-gold"
                  onClick={() => addImageToCanvas(asset)}
                  tabIndex={0}
                  role="listitem"
                  aria-label={`Add image by ${asset.author}`}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        addImageToCanvas(asset);
                     }
                  }}
                >
                  <img 
                    src={asset.previewUrl} 
                    alt={`Stock image by ${asset.author}`}
                    className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col justify-end">
                    <p className="text-[9px] text-white/90 truncate font-medium">By {asset.author}</p>
                    <p className="text-[8px] text-primary-gold font-bold uppercase tracking-wider">{asset.source}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Infinite Scroll Trigger & Load More States */}
            <div ref={loadMoreRef} className="w-full py-4 flex flex-col items-center justify-center min-h-[60px]" aria-live="polite">
              {loadingMore && (
                <div className="flex items-center gap-2 text-[color:var(--text-tertiary)] bg-[color:var(--surface-1)] px-4 py-2 rounded-full shadow-sm border border-[color:var(--border-subtle)]">
                   <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-gold" />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Loading more...</span>
                </div>
              )}
              
              {pageError && (
                 <div className="flex flex-col items-center gap-2 p-3 bg-red-500/5 border border-red-500/10 rounded-lg max-w-[90%] text-center">
                    <span className="text-[10px] text-red-500 font-medium">{pageError}</span>
                    <button 
                       onClick={() => fetchAssets(debouncedQuery, assetType, page + 1, true)}
                       className="flex items-center gap-1.5 px-4 py-1.5 bg-[color:var(--surface-1)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-full text-[10px] font-bold text-primary-gold shadow-sm transition-all"
                       aria-label="Retry loading more assets"
                    >
                       <RefreshCw className="w-3 h-3" />
                       Retry
                    </button>
                 </div>
              )}

              {!hasMore && assets.length > 0 && !loading && (
                 <div className="flex items-center gap-2 px-4 py-2 opacity-50">
                    <div className="h-px w-8 bg-[color:var(--border-subtle)]"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--text-tertiary)]">End of results</span>
                    <div className="h-px w-8 bg-[color:var(--border-subtle)]"></div>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
