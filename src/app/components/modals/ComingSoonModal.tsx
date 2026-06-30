'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, X } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface ComingSoonModalProps {
  featureName?: string;
}

/**
 * Premium "Coming Soon" modal using Contextual Routing
 */
export default function ComingSoonModal({
  featureName = 'This feature',
}: ComingSoonModalProps) {
  const { t } = useTranslation();

  return (
    <ModalWrapper>
      {(onClose) => (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coming-soon-title"
            className="
              relative w-full max-w-sm rounded-3xl overflow-hidden
              bg-[color:var(--surface-1)] border border-[color:var(--border-default)]
              shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(212,175,55,0.08)]
            "
          >
            {/* Top decorative gradient bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#c49b25] via-[#d4af37] to-[#e8c84e]" />

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="
                absolute top-4 right-4 p-1.5 rounded-xl
                text-[color:var(--text-tertiary)] hover:text-white
                hover:bg-white/8 transition-colors z-10
              "
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="px-6 pt-8 pb-7 flex flex-col items-center text-center gap-5">

              {/* Animated rocket icon */}
              <motion.div
                animate={{
                  y: [0, -6, 0],
                  rotate: [0, -3, 3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  w-16 h-16 rounded-2xl
                  bg-gradient-to-br from-primary-gold/15 to-primary-gold/5
                  border border-primary-gold/25
                  flex items-center justify-center
                  shadow-[0_0_30px_rgba(212,175,55,0.15)]
                "
              >
                <Rocket className="w-7 h-7 text-primary-gold" />
              </motion.div>

              {/* Heading */}
              <div>
                <h3
                  id="coming-soon-title"
                  className="text-lg font-bold text-[color:var(--text-primary)] mb-1.5"
                >
                  {t('modals.comingSoon')}
                </h3>
                <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed max-w-[260px]">
                  <span className="font-semibold text-primary-gold">{featureName}</span>{' '}
                  {t('modals.comingSoonDesc')}
                </p>
              </div>

              {/* Decorative progress dots */}
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-primary-gold"
                  />
                ))}
              </div>

              {/* CTA button */}
              <button
                onClick={onClose}
                className="
                  w-full py-3 rounded-2xl text-sm font-bold
                  bg-gradient-to-r from-[color:var(--surface-2)] to-[color:var(--surface-3)]
                  border border-[color:var(--border-default)]
                  text-[color:var(--text-primary)]
                  hover:border-primary-gold/30 hover:bg-primary-gold/5
                  transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold/40
                "
              >
                {t('modals.gotIt')}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </ModalWrapper>
  );
}
