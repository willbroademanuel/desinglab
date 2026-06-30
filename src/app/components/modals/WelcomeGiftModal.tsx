'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { markWelcomeGiftSeenAction } from '@/app/auth/actions';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { interpolate } from '@/locales';
import { Gift, Sparkles } from 'lucide-react';

interface WelcomeGiftModalProps {
  userId: string;
  creditsAmt: number;
  userName: string;
}

export default function WelcomeGiftModal({ userId, creditsAmt, userName }: WelcomeGiftModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExploded, setIsExploded] = useState(false);
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto trigger the "gold explosion" a moment after mount
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      setIsExploded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [mounted]);

  const handleClose = async () => {
    setIsOpen(false);
    // Mark as seen in the database silently
    await markWelcomeGiftSeenAction(userId);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          {/* Intense Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 dark:bg-black/85 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Confetti Shower if Exploded */}
          {isExploded && <ConfettiShower />}

          {/* Rotating Golden Rays */}
          {isExploded && (
            <div className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] animate-[spin_25s_linear_infinite] pointer-events-none" />
          )}

          {/* Modal Content Wrapper */}
          <div className="celebration-scale-wrapper w-full max-w-sm flex items-center justify-center z-20">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 15, stiffness: 120 }}
              className={`relative w-full z-10 rounded-3xl p-[2px] overflow-hidden transition-all duration-1000 ${isExploded
                ? 'bg-gradient-to-br from-[#FDE68A] via-[#D4AF37] to-[#D4AF37] shadow-[0_0_80px_rgba(212,175,55,0.3)]'
                : 'bg-[color:var(--border-default)] shadow-2xl'
                }`}
            >
              <div className="bg-[color:var(--surface-1)] h-full w-full rounded-[22px] p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">

                {/* Background Glow inside card */}
                {isExploded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1.5 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="w-72 h-72 bg-primary-gold/20 blur-[60px] rounded-full" />
                  </motion.div>
                )}

                {/* Animated Icon Area */}
                <div className="relative z-10 w-32 h-32 mb-6 flex items-center justify-center">
                  {/* Center Gift / Bouncing Coin */}
                  {isExploded ? (
                    <div className="relative w-28 h-28 flex flex-col items-center justify-center bg-gradient-to-br from-primary-gold/40 via-primary-gold/20 to-primary-gold/10 border-2 border-primary-gold/60 rounded-full shadow-[0_0_40px_rgba(212,175,55,0.4)] celebration-coin-bounce">
                      <span className="text-4xl font-black text-gradient-gold filter drop-shadow-[0_2px_8px_rgba(212,175,55,0.5)]">
                        +{creditsAmt}
                      </span>
                      <span className="text-[10px] font-black text-primary-gold/80 uppercase tracking-widest mt-0.5">
                        CREDITS
                      </span>
                      {/* Extra micro-sparkles */}
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-gold rounded-full animate-ping" />
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary-gold rounded-full animate-ping" />
                    </div>
                  ) : (
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="relative z-20 flex items-center justify-center w-24 h-24 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] border-2 border-[color:var(--border-subtle)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                    >
                      <Gift size={44} />
                    </motion.div>
                  )}
                </div>

                {/* Text Content */}
                <div className="relative z-10 w-full flex flex-col items-center">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="min-h-[24px] mb-3"
                  >
                    {isExploded && (
                      <span className="inline-block px-3 py-1 bg-primary-gold/10 border border-primary-gold/30 text-primary-gold text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                        {t('credit.prizeClaimedSub')}
                      </span>
                    )}
                  </motion.div>

                  <motion.h2
                    animate={{ color: isExploded ? 'var(--primary-gold)' : 'var(--text-primary)' }}
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 leading-tight drop-shadow-sm line-clamp-2"
                  >
                    {userName}!
                  </motion.h2>

                  <p className="text-[color:var(--text-primary)] text-base mb-8 leading-relaxed max-w-[260px] mx-auto min-h-[40px] flex items-center justify-center">
                    {isExploded ? (
                      <span className="font-medium">
                        Umepokea zawadi ya ukaribisho <span className='text-gradient-gold'>{creditsAmt}</span> credits!
                      </span>
                    ) : (
                      "Tunaandaa zawadi yako ya ukaribisho..."
                    )}
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className={`w-full py-4 rounded-xl font-bold tracking-widest focus:outline-none transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2 uppercase text-xs ${isExploded
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#F2D272] to-[#D4AF37] text-black hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] cursor-pointer'
                      : 'bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)] cursor-wait opacity-50 shadow-none'
                      }`}
                    disabled={!isExploded}
                  >
                    {isExploded ? (
                      <>
                        <Sparkles size={16} className="text-black" />
                        {t('modals.welcomeCTA')}
                      </>
                    ) : (
                      '...'
                    )}
                  </motion.button>

                  <div className="mt-5 text-[10px] text-[color:var(--text-tertiary)] uppercase tracking-widest opacity-60">
                    &copy; {new Date().getFullYear()} Pixtrend AI. All rights reserved.
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Styles matching VoucherCelebration */}
          <style>{`
            .celebration-scale-wrapper {
              transform-origin: center center;
              transition: transform 0.2s ease-out;
            }
            @keyframes celebration-bounce {
              0%, 100% {
                transform: translateY(0);
                animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
              }
              50% {
                transform: translateY(-10px);
                animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
              }
            }
            .celebration-coin-bounce {
              animation: celebration-bounce 2s infinite;
            }
            @media (max-height: 780px) {
              .celebration-scale-wrapper { transform: scale(0.9); }
            }
            @media (max-height: 640px) {
              .celebration-scale-wrapper { transform: scale(0.8); }
            }
            @media (max-height: 520px) {
              .celebration-scale-wrapper { transform: scale(0.7); }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Reusable Confetti Shower from VoucherCelebration
function ConfettiShower() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    delay: number;
    duration: number;
    rotation: number;
  }>>([]);

  useEffect(() => {
    const colors = ['#D4AF37', '#F2D272', '#E5A93B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6'];
    const list = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 6,
      delay: Math.random() * 1.5,
      duration: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
    }));
    setParticles(list);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: 0.85,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            animationName: 'confetti-fall',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(115vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
