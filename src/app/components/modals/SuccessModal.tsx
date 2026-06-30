'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ModalWrapper from './ModalWrapper';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function SuccessModal() {
  const router = useRouter();
  const { t } = useTranslation();

  const [isClosing, setIsClosing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handlePichaYako = async (_closeModal: () => void) => {
    try {
      setIsClosing(true);

      // Trigger immediate refresh of the generations panel
      try {
        window.dispatchEvent(new CustomEvent('open-generations-panel'));
      } catch (eventError) {
        console.error('Error dispatching generations panel event:', eventError);
      }

      // Navigate directly to /dashboard?generations=true.
      // This does two things in a single URL transition:
      //   1. Clears ?template=xxx so MobileUploadModal doesn't flash
      //   2. Sets ?generations=true so the panel opens
      //
      // We do NOT call closeModal() here because closeModal() calls
      // router.back(), which would compete with this replace.
      // The router.replace already navigates away from /m/success,
      // which unmounts the intercepted-route @modal slot naturally.
      //
      // NOTE: Do NOT manually set document.body.style.overflow here.
      // ModalWrapper owns scroll lock lifecycle — setting it here races
      // with ModalWrapper's cleanup and can leave the body permanently locked.
      router.replace('/dashboard?generations=true', { scroll: false });
    } catch (error) {
      console.error('Error handling Picha Yako button click:', error);
      setIsClosing(false);
    }
  };

  return (
    <ModalWrapper
      backdropClass="bg-black/80 backdrop-blur-md"
      preventClickOutside
      isClosing={isClosing}
    >
      {(closeModal) => (
        <div
          className="relative w-full max-w-[340px] bg-onyx border border-green-500/20 rounded-3xl shadow-[0_0_80px_rgba(34,197,94,0.15)] overflow-hidden"
          role="dialog"
          aria-labelledby="success-modal-title"
          aria-describedby="success-modal-description"
        >
          {/* Top green edge glow */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600" />

          <div className="flex flex-col items-center justify-center p-8 gap-6 text-center">
            {/* Animated Ticking Circle */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-2">
              <motion.svg
                className="w-full h-full text-green-500"
                viewBox="0 0 100 100"
                initial="hidden"
                animate="visible"
              >
                {/* Backdrop circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="rgba(34, 197, 94, 0.1)"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeOpacity={0.2}
                />

                {/* Animated drawn circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  variants={{
                    hidden: { pathLength: 0 },
                    visible: {
                      pathLength: 1,
                      transition: { duration: 0.8, ease: 'easeOut' },
                    },
                  }}
                  style={{ rotate: -90, originX: '50%', originY: '50%' }}
                />

                {/* Animated checkmark */}
                <motion.path
                  d="M30 50 L45 65 L70 35"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    visible: {
                      pathLength: 1,
                      opacity: 1,
                      transition: { delay: 0.4, duration: 0.5, ease: 'easeOut' },
                    },
                  }}
                />
              </motion.svg>

              {/* Optional glowing effect behind check */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute inset-0 bg-green-500/20 rounded-full blur-xl -z-10 pointer-events-none"
              />
            </div>

            {/* Text description */}
            <div>
              <motion.h2
                id="success-modal-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-xl font-bold text-white mb-2"
              >
                {t('modals.successTitle')}
              </motion.h2>
              <motion.p
                id="success-modal-description"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-[13px] text-gray-400 leading-relaxed"
              >
                {t('modals.successDesc')}
              </motion.p>
            </div>

            {/* Action Button */}
            <motion.button
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, type: 'spring' }}
              onClick={() => handlePichaYako(closeModal)}
              className="mt-2 w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold tracking-wide transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:opacity-50"
            >
              {t('modals.successCTA')}
            </motion.button>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}
