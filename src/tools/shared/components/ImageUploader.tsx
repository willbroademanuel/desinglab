'use client';

import React, { useCallback, useId, useEffect, useRef, useState } from 'react';
import { UploadCloud, ImageIcon, Camera } from 'lucide-react';
import { GlobalCropModal } from './GlobalCropModal';
import { useTranslation } from '@/lib/i18n/useTranslation';

// ── Security: strict MIME allow-list — no SVG (can carry XSS payloads) ──────
// The fallback `file.type.startsWith('image/')` was intentionally removed;
// it would bypass the allow-list and permit arbitrary image/* subtypes.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// ── Types ────────────────────────────────────────────────────────────────────
interface ImageUploaderProps {
  onUpload: (file: File) => void;
  /** Comma-separated MIME types forwarded to <input accept>. Defaults to common image types. */
  accept?: string;
  /** Max file size in MB. Default: 10MB (mirrors server-side validation). */
  maxSizeMB?: number;
  /** Skip crop modal if the tool handles cropping internally */
  disableCrop?: boolean;
}

// ── Mobile detection (pointer: coarse = touch device) ────────────────────────
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ── Component ────────────────────────────────────────────────────────────────
export function ImageUploader({
  onUpload,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  maxSizeMB = 10,
  disableCrop = false,
}: ImageUploaderProps) {
  // useId() guarantees unique IDs per instance — prevents duplicate-id
  // accessibility violations and removes the clickjacking surface where a
  // remote label could activate the wrong file-input on the page.
  const uid = useId();
  const galleryInputId = `img-uploader-gallery-${uid}`;
  const cameraInputId = `img-uploader-camera-${uid}`;
  const desktopInputId = `img-uploader-desktop-${uid}`;

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  const isMobile = useIsMobile();
  const { t } = useTranslation();

  // ── File validation + crop gate ────────────────────────────────────────────
  const processFile = useCallback(
    (file: File) => {
      setError(null);

      // Security: validate against strict MIME allow-list
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        setError(t('uploader.invalidType'));
        return;
      }

      // Security: client-side size guard (server must re-validate)
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(t('uploader.fileTooLarge', { maxSize: maxSizeMB }));
        return;
      }

      if (disableCrop) {
        onUpload(file);
      } else {
        setPendingCropFile(file);
      }
    },
    [maxSizeMB, disableCrop, onUpload]
  );

  // ── Drag handlers (desktop only) ──────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
      // Reset value so re-selecting the same file fires onChange again
      e.target.value = '';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full flex flex-col items-center justify-center">

        {isMobile ? (
          /* ── Mobile: guided upload card ── */
          <div className="w-full px-4 py-6 flex flex-col items-center gap-5">

            {/* Hero zone — tapping anywhere on this area opens gallery */}
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="
                group relative w-full rounded-2xl overflow-hidden
                border-2 border-dashed border-[color:var(--border-subtle)]
                bg-[color:var(--surface-1)]
                active:scale-[0.98] transition-all duration-200
                hover:border-primary-gold/40 hover:bg-[color:var(--surface-2)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold/60
              "
              aria-label={t('uploader.tapToSelect')}
            >
              {/* Animated gradient ring */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary-gold/5 via-transparent to-transparent pointer-events-none" />

              <div className="flex flex-col items-center justify-center py-10 px-6 gap-4">
                {/* Upload icon bubble */}
                <div className="
                  relative w-20 h-20 rounded-xl flex items-center justify-center
                  bg-primary-gold/10 border border-primary-gold/20
                  group-hover:bg-primary-gold/20 group-hover:border-primary-gold/40
                  transition-all duration-200
                ">
                  <UploadCloud className="w-9 h-9 text-primary-gold" />
                  {/* Pulse ring */}
                  <span className="absolute inset-0 rounded-xl border border-primary-gold/30 animate-ping opacity-30" />
                </div>

                {/* Instructional copy */}
                <div className="text-center">
                  <p className="text-[17px] font-bold text-[color:var(--text-primary)] mb-1">
                    {t('uploader.tapToSelect')}
                  </p>
                  <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed">
                    {t('uploader.mobileHint')}
                  </p>
                </div>
              </div>
            </button>


            {/* Secondary CTA — Camera */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="
                w-full py-4 rounded-xl
                bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)]
                text-[color:var(--text-primary)] font-semibold text-[15px]
                flex items-center justify-center gap-2.5
                active:scale-[0.97] transition-all duration-150
                hover:bg-[color:var(--surface-3)] hover:border-[color:var(--border-default)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-default)]
              "
              aria-label={t('uploader.takePhoto')}
            >
              <Camera className="w-5 h-5 text-[color:var(--text-secondary)]" />
              {t('uploader.takePhoto')}
            </button>

            {/* Hidden inputs — gallery (no capture) + camera (capture=environment) */}
            <input
              ref={galleryRef}
              id={galleryInputId}
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleChange}
            />
            <input
              ref={cameraRef}
              id={cameraInputId}
              type="file"
              className="hidden"
              accept={accept}
              capture="environment"
              onChange={handleChange}
            />
          </div>
        ) : (
          /* ── Desktop: drag-and-drop zone ── */
          <label
            htmlFor={desktopInputId}
            className={`
              w-full aspect-[2/1] md:aspect-[3/1] max-w-2xl flex flex-col
              items-center justify-center border-2 border-dashed rounded-lg
              cursor-pointer transition-all duration-300
              ${dragActive
                ? 'border-primary-gold bg-primary-gold/5 scale-[1.02]'
                : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] hover:bg-[color:var(--surface-2)]'
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <div className="w-14 h-14 bg-[color:var(--surface-3)] rounded-lg flex items-center justify-center mb-4 text-[color:var(--text-tertiary)] transition-colors">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="mb-2 text-sm text-[color:var(--text-secondary)] font-medium">
                <span className="font-semibold text-primary-gold">{t('uploader.clickToUpload')}</span> {t('uploader.dragDrop')}
              </p>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                {t('uploader.desktopHint', { maxSize: maxSizeMB })}
              </p>
            </div>
            <input
              id={desktopInputId}
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleChange}
            />
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl max-w-2xl w-full text-center"
          >
            {error}
          </div>
        )}
      </div>

      {pendingCropFile && (
        <GlobalCropModal
          file={pendingCropFile}
          onConfirm={(croppedFile) => {
            setPendingCropFile(null);
            onUpload(croppedFile);
          }}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </>
  );
}
