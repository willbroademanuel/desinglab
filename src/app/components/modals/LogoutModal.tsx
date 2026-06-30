'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogOut, X, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import ModalWrapper from './ModalWrapper';
import { useNavigationGuard } from '@/lib/providers/NavigationGuardProvider';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function LogoutModal() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const { registerOverlay } = useNavigationGuard();
  const registeredRef = useRef(false);
  const { t } = useTranslation();

  // Register with NavigationGuardProvider so the back-button handler
  // knows this modal is open. Without this, pressing Cancel triggers
  // popstate → guard sees "no overlays" → pushes /m/logout → infinite loop.
  //
  // IMPORTANT: closeFn is intentionally a no-op. The popstate event
  // already consumed the sentinel entry. The browser's natural "back"
  // then pops the /m/logout route entry, unmounting this intercepted
  // route. Calling router.back() here would double-pop and create
  // another popstate → triggering the guard again → loop.
  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const unregister = registerOverlay(
      'logout-modal',
      () => { /* no-op — see comment above */ },
      100 // High priority — logout should be dismissed before other overlays
    );

    return () => {
      unregister();
      registeredRef.current = false;
    };
  }, [registerOverlay]);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // After signout, directly push to login so we exit the SPA cleanly
    window.location.href = '/auth/login';
  };

  return (
    <ModalWrapper backdropClass="bg-black/80 backdrop-blur-sm">
      {(onClose) => (
        <div className="relative w-full max-w-sm bg-onyx border border-red-500/20 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_40px_rgba(239,68,68,0.1)] overflow-hidden">
          
          {/* Top red warning bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-600 to-red-400" />
          
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 pt-10 flex flex-col items-center text-center gap-6">
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
            >
              <AlertTriangle className="w-8 h-8" />
            </motion.div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">{t('modals.logoutTitle')}</h2>
              <p className="text-[13px] text-gray-400 leading-relaxed max-w-[240px]">
                {t('modals.logoutDesc')}
              </p>
            </div>

            <div className="w-full flex flex-col gap-3 mt-2">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
              >
                {signingOut ? t('modals.loggingOut') : t('modals.logoutConfirm')}
              </button>
              <button
                onClick={onClose}
                disabled={signingOut}
                className="w-full py-3.5 rounded-xl bg-[color:var(--surface-2)] border border-[color:var(--border-default)] hover:border-gray-500 text-[color:var(--text-primary)] font-bold tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                {t('modals.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}
