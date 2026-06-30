'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEMPLATE_CATEGORIES } from '@/lib/template-categories';

export interface Template {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  is_active: boolean;
  is_featured: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  category_icon_color?: string;
}

interface StyleGalleryProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
}

export default function StyleGallery({ templates, selectedTemplateId, onSelectTemplate }: StyleGalleryProps) {
  const allCategories = Array.from(new Set([
    ...TEMPLATE_CATEGORIES,
    ...templates.map(t => t.category)
  ]));

  const [activeCategory, setActiveCategory] = useState<string>(allCategories[0] || TEMPLATE_CATEGORIES[0]);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // Important: don't auto-deselect if they click another button (e.g. Generate button)
      if (galleryRef.current && !galleryRef.current.contains(target) && !target.closest('button')) {
        if (selectedTemplateId) {
          onSelectTemplate(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedTemplateId, onSelectTemplate]);

  const filteredTemplates = templates.filter(t => t.category === activeCategory);

  return (
    <div className="w-full" ref={galleryRef}>
      <h2 className="text-xl font-bold text-white mb-4">2. Chagua Mtindo (Select Style)</h2>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${activeCategory === cat
              ? 'bg-primary-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
              : 'bg-onyx text-gray-400 hover:text-white hover:bg-onyx-border border border-onyx-border'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
        >
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => {
              const isSelected = selectedTemplateId === template.id;

              return (
                <motion.div
                  key={template.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectTemplate(template.id)}
                  className={`relative flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-colors duration-300 min-h-[220px] h-[min(280px,42vw)] ${isSelected
                    ? 'border-2 border-primary-gold ring-4 ring-primary-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    : 'border border-onyx-border shadow-lg hover:border-gray-500'
                    }`}
                >
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-neutral-950/80 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={template.thumbnail_url || ''}
                      alt={template.name}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </div>
                  <div className="shrink-0 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col justify-end p-3 pt-6">
                    <h3 className={`font-bold text-sm ${isSelected ? 'text-primary-gold' : 'text-white'}`}>
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-gray-300 line-clamp-1 mt-0.5">{template.description}</p>
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500 bg-onyx/30 rounded-2xl border border-dashed border-onyx-border">
              Hakuna mitindo katika kundi hili bado. (No styles yet)
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
