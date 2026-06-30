'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { loginAction } from '../actions';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ForgotPasswordModal, ThemeToggle, ParticleBackground } from '@/app/components';

const loginSchema = z.object({
  phone: z.string().regex(/^(06|07)\d{8}$/, 'Must be a valid TZ number usually 06/07XXXXXXXX'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('phone', data.phone);
    formData.append('password', data.password);

    try {
      const result = await loginAction(formData);
      if (result?.error) {
        setServerError(result.error);
        setIsSubmitting(false);
      } else if (result?.success) {
        // CRITICAL: Use hard navigation to clear auth pages from the browser history.
        // router.replace() only replaces within the SPA — the browser's native history
        // entries from / → /auth/login would remain, causing back button to land here.
        // window.location.replace() performs a full navigation that replaces the current
        // history entry entirely, so /auth/login is gone from the back stack.
        if (result.restricted) {
          window.location.replace('/restricted');
        } else {
          window.location.replace('/');
        }
      }
    } catch (err) {
      setServerError('An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <ParticleBackground />
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 md:top-8 md:right-8 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-onyx border border-onyx-border rounded-2xl p-8 shadow-2xl backdrop-blur-lg relative z-10">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gradient-gold">Welcome Back</h1>
          <p className="text-[color:var(--text-secondary)] mt-2 text-sm">Sign in to Pixtrend.</p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Phone */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">Phone (Tanzania)</label>
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
              className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors"
            />
            {errors.phone && <p className="text-error text-xs">{errors.phone.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-[color:var(--text-secondary)]">Password</label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-xs text-primary-gold hover:underline transition-colors"
              >
                Umesahau Nywila?
              </button>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                maxLength={64}
                placeholder="••••••••"
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
              {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : 'Sign In'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-[color:var(--text-secondary)]">
          Don't have an account? <Link href="/auth/signup" className="text-primary-gold hover:underline">Sign up</Link>
        </p>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
}
