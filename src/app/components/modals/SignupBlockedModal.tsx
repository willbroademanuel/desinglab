'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import { useNavigationGuard } from '@/lib/providers/NavigationGuardProvider';

export default function SignupBlockedModal() {
  const { registerOverlay } = useNavigationGuard();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const unregister = registerOverlay(
      'signup-blocked-modal',
      () => { /* no-op */ },
      90
    );

    return () => {
      unregister();
      registeredRef.current = false;
    };
  }, [registerOverlay]);

  return (
    <ModalWrapper backdropClass="bg-black/85 backdrop-blur-md">
      {(onClose) => (
        <div className="relative w-full max-w-md bg-onyx border border-amber-500/20 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.1)] overflow-hidden">
          
          {/* Top amber aesthetic accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500" />
          
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 pt-10 flex flex-col items-center text-center gap-6">
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-pulse"
            >
              <AlertTriangle className="w-8 h-8" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2 text-gradient-gold">Usajili Umefungwa</h2>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4">Registrations Suspended</p>
              
              <div className="bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-2xl p-4 text-[13px] text-gray-300 leading-relaxed text-left space-y-3">
                <p>
                  Ndugu mtumiaji, usajili wa akaunti mpya kwenye mfumo wa DesignLab umesitishwa kwa sasa kwa ajili ya kufanya maboresho ya kiufundi.
                </p>
                <div className="border-t border-white/5 pt-2" />
                <p className="italic text-xs text-gray-400">
                  New account signups are temporarily suspended for scheduled technical system tuning. Please check back later.
                </p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-2">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Sawa / Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}
