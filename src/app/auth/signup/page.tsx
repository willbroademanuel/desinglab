'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { initiateSignup, verifyAndFinalizeSignup, getAppSettingsAction } from '../actions';
import { Loader2, Eye, EyeOff, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OTPModal, ThemeToggle, ParticleBackground } from '@/app/components';

// Sheria za Uhakiki zilizotafsiriwa kwa Kiswahili
const signupSchema = z.object({
  password: z.string()
    .min(8, 'Nywila lazima iwe na herufi kuanzia 8')
    .max(64, 'Nywila ni ndefu mno (mwisho herufi 64)')
    .regex(/[a-zA-Z]/, 'Nywila lazima iwe na angalau herufi moja (A-Z, a-z)'),
  username: z.string()
    .min(3, 'Jina lazima liwe na herufi kuanzia 3')
    .max(30, 'Jina lako ni refu mno (mwisho herufi 30)'),
  phone: z.string().regex(/^(06|07)\d{8}$/, 'Tafadhali tumia muundo: 07XXXXXXXX au 06XXXXXXXX'),
  acceptTerms: z.literal(true, {
    message: "Tafadhali kubali masharti na sera ya faragha ili uendelee"
  })
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignupBlocked, setIsSignupBlocked] = useState(false);

  useEffect(() => {
    async function checkSignupBlocked() {
      try {
        const res = await getAppSettingsAction();
        if (res?.success && res?.settings?.block_signups) {
          setIsSignupBlocked(true);
        }
      } catch (err) {
        console.error('Failed to check signup block settings:', err);
      }
    }
    checkSignupBlocked();
  }, []);

  // OTP Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  if (isSignupBlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <ParticleBackground />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.07)_0,transparent_60%)] pointer-events-none" />
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 md:top-8 md:right-8 z-50">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md bg-onyx border border-onyx-border rounded-2xl p-8 shadow-2xl backdrop-blur-lg relative z-10 animate-fade-in-up">
          <div className="mb-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gradient-gold">Usajili Umefungwa</h1>
            <p className="text-sm font-semibold text-amber-500 mt-1">Registrations Temporarily Suspended</p>
          </div>

          <div className="space-y-6 text-center">
            <div className="bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl p-5 text-sm space-y-4 leading-relaxed text-[color:var(--text-secondary)]">
              <p>
                Ndugu mtumiaji, usajili wa akaunti mpya kwenye mfumo wa DesignLab umesitishwa kwa sasa kwa ajili ya matengenezo ya kiufundi.
              </p>
              <div className="border-t border-[color:var(--border-subtle)] pt-3" />
              <p className="italic text-xs">
                Dear user, new registrations are temporarily disabled for scheduled technical maintenance. Please try again later.
              </p>
            </div>

            <div className="w-full pt-1 group">
              <Link
                href="/auth/login"
                className="w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center gap-2 bg-foreground text-surface-1 hover:bg-foreground/90 group-hover:scale-[1.01] group-hover:-translate-y-1 active:scale-[0.98] active:translate-y-0 cursor-pointer shadow-[2px_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[6px_12px_24px_rgba(0,0,0,0.15)] active:shadow-[1px_2px_4px_rgba(0,0,0,0.1)] dark:bg-gradient-to-r dark:from-[#d4af37] dark:to-[#b8860b] dark:hover:from-[#e8c84e] dark:hover:to-[#d4af37] dark:text-white dark:shadow-[2px_4px_10px_rgba(212,175,55,0.2)] dark:hover:shadow-[6px_12px_24px_rgba(212,175,55,0.4)] dark:active:shadow-[1px_2px_4px_rgba(212,175,55,0.15)]"
              >
                <ArrowLeft size={16} />
                Ingia kwenye Akaunti / Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Store form data to pass to verify step later
  const [pendingSignupData, setPendingSignupData] = useState<{
    originalPhone: string;
    formattedPhone: string;
    username: string;
    password: string;
  } | null>(null);

  const { register, handleSubmit, getValues, formState: { errors, isValid } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('password', data.password);
    formData.append('username', data.username);
    formData.append('phone', data.phone);

    try {
      const result = await initiateSignup(formData);
      if (result?.error) {
        setServerError(result.error);
        setIsSubmitting(false);
      } else if (result?.success) {
        setPendingSignupData({
          originalPhone: data.phone,
          formattedPhone: result.formattedPhone!,
          username: result.processedUsername!,
          password: data.password,
        });
        setIsOtpModalOpen(true);
      }
    } catch (err) {
      setServerError('Hitilafu isiyotarajiwa imetokea.');
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (otp: string): Promise<string | null> => {
    if (!pendingSignupData) return "Tafadhali anza upya njia ya kujiunga.";

    const formData = new FormData();
    formData.append('phone', pendingSignupData.formattedPhone);
    formData.append('otp', otp);
    formData.append('password', pendingSignupData.password);
    formData.append('username', pendingSignupData.username);
    formData.append('originalPhone', pendingSignupData.originalPhone);

    try {
      const result = await verifyAndFinalizeSignup(formData);
      if (result?.error) {
        return result.error;
      } else if (result?.success) {
        // CRITICAL: Use hard navigation to clear auth pages from the browser history.
        // This prevents the back button from sending users to /auth/signup.
        // See login/page.tsx for detailed rationale.
        window.location.replace('/');
        return null;
      }
    } catch (err) {
      return "Imeshindwa kuthibitisha OTP. Jaribu tena.";
    }
    return "Imeshindwa kuthibitisha OTP. Jaribu tena.";
  };

  const handleResendOtp = async (): Promise<string | null> => {
    const currentValues = getValues();
    const formData = new FormData();
    formData.append('password', currentValues.password);
    formData.append('username', currentValues.username);
    formData.append('phone', currentValues.phone);

    try {
      const result = await initiateSignup(formData);
      if (result?.error) {
        return result.error;
      }
      return null;
    } catch (err) {
      return "Imeshindwa kutuma tena OTP.";
    }
  };

  const handleCloseOtpModal = () => {
    setIsOtpModalOpen(false);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <ParticleBackground />
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 md:top-8 md:right-8 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-onyx border border-onyx-border rounded-2xl p-8 shadow-2xl backdrop-blur-lg relative z-10">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gradient-gold">Jiunge na DesignLab</h1>
          <p className="text-[color:var(--text-secondary)] mt-2 text-xs">Tengeneza akaunti uweze kutumia DesignLab.</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Jina la mtumiaji */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Jina la mtumiaji</label>
            <input
              {...register('username')}
              type="text"
              autoComplete="username"
              maxLength={30}
              placeholder="Enter your display name"
              disabled={isSubmitting}
              className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors"
            />
            {errors.username && <p className="text-error text-xs">{errors.username.message}</p>}
          </div>

          {/* Simu */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Namba ya Simu (Tanzania)</label>
            <input
              {...register('phone', {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\D/g, '');
                }
              })}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
              maxLength={10}
              placeholder="07XXXXXXXX"
              disabled={isSubmitting}
              className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors"
            />
            {errors.phone && <p className="text-error text-xs">{errors.phone.message}</p>}
          </div>

          {/* Nywila */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Nywila</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={64}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors pr-12 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <p className="text-error text-xs">{errors.password.message}</p>}
          </div>

          {/* Sehemu ya Masharti na Sera ya Faragha */}
          <div className="pt-2">
            <div className="flex items-start space-x-3">
              <div className="flex items-center h-5 mt-1">
                {/* Bug Fix: Comment imeondolewa ndani ya tag ya input */}
                <input
                  {...register('acceptTerms')}
                  type="checkbox"
                  id="acceptTerms"
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-[color:var(--border-default)] bg-[color:var(--surface-2)] text-primary-gold focus:ring-0 focus:ring-offset-0 outline-none cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="acceptTerms" className="text-xs text-[color:var(--text-secondary)]">
                  Nakubaliana na{' '}
                  <Link href="/terms" className="text-primary-gold hover:underline" target="_blank">
                    Masharti na Vigezo
                  </Link>
                  {' '}pamoja na{' '}
                  <Link href="/privacy" className="text-primary-gold hover:underline" target="_blank">
                    Sera ya Faragha
                  </Link>{' '}
                  ya DesignLab.
                </label>
              </div>
            </div>

            {errors.acceptTerms && (
              <p className="text-error text-xs mt-2 text-center w-full block italic">
                Unatakiwa kukubali vigezo na masharti ili kuendelea.
              </p>
            )}
          </div>

          <div className="w-full pt-1 group">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className={`w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center
                ${(!isValid || isSubmitting)
                  ? 'bg-[color:var(--border-default)] text-[color:var(--text-tertiary)] cursor-not-allowed'
                  : 'bg-foreground text-surface-1 hover:bg-foreground/90 group-hover:scale-[1.01] group-hover:-translate-y-1 active:scale-[0.98] active:translate-y-0 cursor-pointer shadow-[2px_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[6px_12px_24px_rgba(0,0,0,0.15)] active:shadow-[1px_2px_4px_rgba(0,0,0,0.1)] dark:bg-gradient-to-r dark:from-[#d4af37] dark:to-[#b8860b] dark:hover:from-[#e8c84e] dark:hover:to-[#d4af37] dark:text-white dark:shadow-[2px_4px_10px_rgba(212,175,55,0.2)] dark:hover:shadow-[6px_12px_24px_rgba(212,175,55,0.4)] dark:active:shadow-[1px_2px_4px_rgba(212,175,55,0.15)]'
                }
              `}
            >
              {isSubmitting && !isOtpModalOpen ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : 'Jiunge Sasa'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-[color:var(--text-secondary)]">
          Tayari una akaunti? <Link href="/auth/login" className="text-primary-gold hover:underline">Ingia hapa</Link>
        </p>
      </div>

      <OTPModal
        isOpen={isOtpModalOpen}
        onClose={handleCloseOtpModal}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </div>
  );
}