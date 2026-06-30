'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ServerCog, X, ShieldAlert } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import { useNavigationGuard } from '@/lib/providers/NavigationGuardProvider';

export default function ReadOnlyModal() {
  const { registerOverlay } = useNavigationGuard();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const unregister = registerOverlay(
      'read-only-modal',
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
        <div className="relative w-full max-w-md bg-onyx border border-violet-500/20 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(139,92,246,0.1)] overflow-hidden">

          {/* Top violet/indigo aesthetic accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-500" />

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
              className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.2)] animate-pulse"
            >
              <ServerCog className="w-8 h-8" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2 text-gradient-gold">Huduma Imesitishwa kwa Muda</h2>
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Read-Only Mode Active</p>

              <div className="bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-2xl p-4 text-[13px] text-gray-300 leading-relaxed text-left space-y-3">
                <p>
                  Ndugu mtumiaji, kwa sasa mfumo wetu upo kwenye matengenezo ya kina. Ili kuboresha injini za AI kuwa bora zaidi, hutaweza kutumia baadhi ya huduma zinazohitaji credits kwa sasa.
                </p>
                <p>
                  Huduma za kutengeneza na kuboresha picha au video mpya zimesitishwa kwa muda. Tunaomba radhi kwa usumbufu huu.
                </p>
                <div className="border-t border-white/5 pt-2" />
                <p className="italic text-xs text-gray-400">
                  The platform is currently in read-only mode for essential system maintenance. You will not be able to spend credits at this time, and photo/video generation features are temporarily suspended. We expect to be fully online shortly.
                </p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-2">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Nimeelewa / I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}
