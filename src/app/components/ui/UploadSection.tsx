'use client';

import React, { useRef } from 'react';
import { Plus, X, Camera, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useTranslation } from '@/lib/i18n/useTranslation';

interface UploadSectionProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  previewUrl: string | null;
}

export default function UploadSection({ onFileSelect, selectedFile, previewUrl }: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const { t } = useTranslation();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia('(max-width: 767px)').matches);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
      }
      e.target.value = '';
    } catch (err) {
      console.error("File selection error:", err);
      alert(t('error.generic'));
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-white mb-4">1. Weka Picha (Upload Photo)</h2>
      
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0]);
          }
        }}
        className={`relative w-full rounded-3xl transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
          ${selectedFile 
            ? 'min-h-[200px] max-h-[min(70vh,720px)] border-2 border-primary-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]' 
            : 'aspect-[4/5] md:aspect-video border-2 border-dashed border-onyx-border hover:border-gray-500 bg-onyx/50 hover:bg-onyx'
          }
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={cameraInputRef}
          onChange={handleFileChange}
          accept="image/*" 
          capture="environment"
          className="hidden" 
        />

        <AnimatePresence mode="wait">
          {previewUrl && selectedFile ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full flex-1 min-h-0 flex items-center justify-center p-3 overflow-auto"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={previewUrl} 
                alt="Selected reference" 
                className="max-w-full max-h-[min(65vh,680px)] w-auto h-auto object-contain"
              />
              <button 
                type="button"
                onClick={clearSelection}
                className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-2 rounded-full text-white hover:bg-error transition-colors z-10"
              >
                <X size={20} />
              </button>
            </motion.div>
          ) : isMobile ? (
            <motion.div
              key="mobile-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center w-full px-6 gap-4"
            >
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-200">Weka Picha (Select Photo)</p>
              </div>
              <button
                type="button"
                onClick={() => { try { cameraInputRef.current?.click(); } catch(e) {} }}
                className="flex items-center justify-center gap-2 w-full py-4 bg-primary-gold/10 border border-primary-gold/30 rounded-xl text-sm font-semibold text-white hover:bg-primary-gold/20 transition-colors"
              >
                <Camera className="w-5 h-5 text-primary-gold" />
                {t('upload.camera')}
              </button>
              <button
                type="button"
                onClick={() => { try { fileInputRef.current?.click(); } catch(e) {} }}
                className="flex items-center justify-center gap-2 w-full py-4 bg-onyx border border-onyx-border rounded-xl text-sm font-semibold text-white hover:bg-onyx/80 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-gray-400" />
                {t('upload.gallery')}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="desktop-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-primary-gold/10 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-primary-gold" />
              </div>
              <p className="text-lg font-semibold text-gray-200">Bofya kuweka picha</p>
              <p className="text-sm text-gray-500 mt-2">Picha yenye ubora inaleta matokeo mazuri</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
