'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { registerActiveModal, unregisterActiveModal } from '@/lib/modalSignal';

interface ModalWrapperProps {
  children: (closeModal: () => void) => React.ReactNode;
  backdropClass?: string;
  preventClickOutside?: boolean;
  isClosing?: boolean;
}

// Module-level counter: tracks how many ModalWrappers are currently mounted.
// Only clear overflow when the last one unmounts, preventing one modal's
// cleanup from stomping on another modal's legitimate scroll lock.
let scrollLockCount = 0;

export default function ModalWrapper({ 
  children, 
  backdropClass = 'bg-black/70 backdrop-blur-sm',
  preventClickOutside = false,
  isClosing = false,
}: ModalWrapperProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    // Signal to NavigationGuardProvider that an intercepted-route modal
    // is active. This prevents the guard from opening the logout modal
    // when router.back() fires a popstate event during close.
    registerActiveModal();

    scrollLockCount++;
    document.body.style.overflow = 'hidden';

    return () => {
      unregisterActiveModal();
      scrollLockCount--;
      // Only release scroll lock when the LAST modal unmounts.
      // This prevents cleanup of one modal from unlocking scroll
      // while another modal is still open (e.g. SuccessModal closing
      // while ImagePreviewModal is about to open).
      if (scrollLockCount <= 0) {
        scrollLockCount = 0; // guard against underflow
        document.body.style.overflow = '';
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    // Prevent double-close from racing clicks/keys
    if (closingRef.current) return;
    closingRef.current = true;

    // Use router.back() to close intercepted route modals.
    //
    // This is the ONLY correct way to unmount a Next.js @modal parallel
    // route slot. router.replace() changes the URL but leaves the slot
    // content rendered — causing the modal to visually persist.
    //
    // The previous ghost-reopening bug (back() landing on stale /m/success)
    // was caused by router.refresh() race conditions, NOT by router.back()
    // itself. Those races have been eliminated from:
    //   - OutOfCreditModal (removed refresh on mount)
    //   - SuccessModal (removed refresh on mount)
    //   - TemplatesClient (removed refresh after push)
    router.back();
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!mounted) return null;

  return (
    <motion.div 
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${isClosing ? 'pointer-events-none' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        onClick={preventClickOutside ? undefined : handleClose}
        className={`absolute inset-0 ${backdropClass}`}
        aria-hidden="true"
      />
      
      {/* Intentionally passing handleClose so the inner child can invoke smart close (e.g. 'X' button) */}
      <div className="relative z-10 w-full flex justify-center items-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl flex justify-center">
          {children(handleClose)}
        </div>
      </div>
    </motion.div>
  );
}
