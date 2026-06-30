'use client';

import React, { useState } from 'react';
import { acceptLegalUpdateAction } from '@/app/auth/actions';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { interpolate } from '@/locales';

// Define minimal supabase client for logout
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TermsUpdateModalProps {
  termsVersion: string;
  privacyVersion: string;
}

export default function TermsUpdateModal({ termsVersion, privacyVersion }: TermsUpdateModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    if (!isChecked) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await acceptLegalUpdateAction(termsVersion, privacyVersion);
      
      if (!res.success) {
        setError(res.error || t('legal.errorDefault'));
        setIsSubmitting(false);
        return;
      }

      // Server action calls revalidatePath, but we also force a client-side
      // refresh to guarantee the layout re-evaluates and unmounts this modal.
      router.refresh();

      // Safety net: if revalidation/refresh fails to unmount this modal
      // within 5 seconds (e.g. stale cache, auth token issues), hard reload.
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err) {
      console.error('[TermsUpdateModal] Accept failed:', err);
      setError(t('legal.errorNetwork'));
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    await supabase.auth.signOut();
    window.location.replace('/auth/login');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-onyx border border-onyx-border rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fade-in-up relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-amber-500/20 blur-2xl rounded-full" />
        
        <div className="text-center mb-6 relative z-10">
          <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-4 text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gradient-gold">{t('legal.title')}</h2>
          <p className="text-[color:var(--text-secondary)] mt-3 text-sm leading-relaxed">
            {t('legal.description')}{' '}
            <a href="/terms" target="_blank" className="text-primary-gold hover:underline mx-0.5 font-medium">{t('legal.termsLink')}</a>
            {' '}{t('legal.and')}{' '}
            <a href="/privacy" target="_blank" className="text-primary-gold hover:underline mx-0.5 font-medium">{t('legal.privacyLink')}</a>
            {' '}(v{termsVersion}).
          </p>
          <p className="text-[color:var(--text-tertiary)] mt-2 text-xs">
            {t('legal.reviewPrompt')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex items-start space-x-3 mb-6">
          <button
            type="button"
            onClick={() => !isSubmitting && setIsChecked(!isChecked)}
            disabled={isSubmitting}
            className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer ${
              isChecked
                ? 'bg-gradient-to-br from-[#d4af37] to-[#b8860b] border-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.3)]'
                : 'bg-transparent border-[color:var(--border-default)] hover:border-amber-500/50'
            }`}
            aria-label="Accept terms checkbox"
          >
            {isChecked && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <label 
            onClick={() => !isSubmitting && setIsChecked(!isChecked)}
            className="text-sm text-[color:var(--text-secondary)] cursor-pointer select-none leading-relaxed"
          >
            {interpolate(t('legal.checkbox'), { version: termsVersion })}
          </label>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handleAgree}
            disabled={!isChecked || isSubmitting}
            className={`w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center
              ${(!isChecked || isSubmitting)
                ? 'bg-[color:var(--border-default)] text-[color:var(--text-tertiary)] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-white shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:opacity-90'
              }
            `}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('legal.accept')}
          </button>
          
          <button
            onClick={handleLogout}
            disabled={isSubmitting}
            className="w-full py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2 text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-2)] hover:text-text-primary"
          >
            <LogOut className="w-4 h-4" />
            {t('legal.logout')}
          </button>
        </div>

      </div>
    </div>
  );
}
