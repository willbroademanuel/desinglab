'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X, Eye, EyeOff } from 'lucide-react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { initiatePasswordReset, validateResetOtp, resetPasswordAction } from '@/app/auth/actions';
import { useRouter } from 'next/navigation';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'PHONE' | 'OTP' | 'PASSWORD' | 'SUCCESS';

const phoneSchema = z.object({
  phone: z.string().regex(/^(06|07)\d{8}$/, 'Weka namba sahihi ya Tanzania (mfano 07XXXXXXXX)'),
});

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Nywila lazima iwe na angalau herufi 8')
    .max(64, 'Nywila ni ndefu mno (mwisho herufi 64)')
    .regex(/[a-zA-Z]/, 'Nywila lazima iwe na angalau herufi moja (A-Z, a-z)'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Nywila hazifanani",
  path: ["confirmPassword"],
});

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('PHONE');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Stored Data
  const [requireManualLogin, setRequireManualLogin] = useState(false);
  const [originalPhone, setOriginalPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState('');

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    mode: 'onChange'
  });

  const pwForm = useForm({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange'
  });

  useEffect(() => {
    if (isOpen) {
      setStep('PHONE');
      setError(null);
      setOtp(['', '', '', '', '', '']);
      phoneForm.reset();
      pwForm.reset();
    }
  }, [isOpen, phoneForm, pwForm]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0 && step === 'OTP' && isOpen) {
      timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown, step, isOpen]);


  const onPhoneSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('phone', data.phone);

    try {
      const res = await initiatePasswordReset(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setOriginalPhone(res.originalPhone!);
        setFormattedPhone(res.formattedPhone!);
        setResendCountdown(60);
        setStep('OTP');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      setError("Imeshindwa kuwasiliana na seva.");
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Handlers
  const handleOtpChange = (index: number, value: string) => {
    // Extract digits to cleanly handle inputs
    const digits = value.replace(/\D/g, '');
    
    // Handle clearing
    if (!digits) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    // Handle Mobile Native "Auto-Fill from SMS" which fires onChange with all 6 digits at once
    if (digits.length > 1) {
      const newOtp = [...otp];
      digits.slice(0, 6).split('').forEach((char, i) => {
        newOtp[i] = char;
      });
      setOtp(newOtp);
      
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      if (newOtp.every(d => d !== '')) {
        verifyOtp(newOtp.join(''));
      }
      return;
    }

    // Standard single character entry
    const newOtp = [...otp];
    newOtp[index] = digits.substring(digits.length - 1);
    setOtp(newOtp);

    // Auto-advance
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (index === 5 && newOtp.every(digit => digit !== '')) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '');
    
    if (!digits) return;

    const pastedData = digits.slice(0, 6).split('');
    const newOtp = [...otp];
    pastedData.forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (newOtp.every(digit => digit !== '')) {
      verifyOtp(newOtp.join(''));
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('phone', formattedPhone);
    formData.append('otp', code);

    try {
      const res = await validateResetOtp(formData);
      if (res?.error) {
        setError(res.error);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else if (res?.success) {
        setVerifiedOtp(code);
        setStep('PASSWORD');
      }
    } catch (err) {
      setError("Imeshindwa kuhakiki OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isLoading) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('phone', originalPhone);

    try {
      const res = await initiatePasswordReset(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        setResendCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError("Imeshindwa kutuma tena.");
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('phone', formattedPhone);
    formData.append('originalPhone', originalPhone);
    formData.append('otp', verifiedOtp);
    formData.append('newPassword', data.password);

    try {
      const res = await resetPasswordAction(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        if (res.requireManualLogin) {
            setRequireManualLogin(true);
        } else {
            // Unstated professional step UX: Automatically redirect to dashboard after slight delay to show success
            setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 2500);
        }
        setStep('SUCCESS');
      }
    } catch (err) {
      setError("Imeshindwa kubadili nywila.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden transition-all duration-300">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
          disabled={isLoading}
        >
          <X size={20} />
        </button>

        {step === 'PHONE' && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient-gold mb-2">Umesahau Nywila?</h2>
              <p className="text-gray-400 text-sm">
                Weka namba yako ya simu ili tukutumie namba ya siri (OTP) ya kubadili nywila yako.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-5">
              <div className="space-y-1">
                <input
                  {...phoneForm.register('phone')}
                  type="tel"
                  placeholder="07XXXXXXXX"
                  disabled={isLoading}
                  className="w-full bg-black/40 border border-onyx-border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors"
                />
                {phoneForm.formState.errors.phone && (
                  <p className="text-error text-xs">{phoneForm.formState.errors.phone.message as string}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!phoneForm.formState.isValid || isLoading}
                className={`w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center
                  ${(!phoneForm.formState.isValid || isLoading)
                    ? 'bg-onyx-border text-gray-400 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-gold-light to-primary-gold text-black hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  }
                `}
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5 text-black" /> : 'Tuma OTP'}
              </button>
            </form>
          </div>
        )}

        {step === 'OTP' && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient-gold mb-2">Thibitisha Namba Yako</h2>
              <p className="text-gray-400 text-sm">
                Tumekutumia namba ya siri. Tafadhali iweke hapa chini.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-1.5 sm:gap-2 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${index + 1} of 6`}
                  pattern="\d*"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  disabled={isLoading}
                  className="w-10 h-12 sm:w-12 sm:h-14 bg-black/40 border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors disabled:opacity-50"
                />
              ))}
            </div>

            <button
              onClick={() => verifyOtp(otp.join(''))}
              disabled={isLoading || otp.some(d => d === '')}
              className={`w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center mb-4
                ${(isLoading || otp.some(d => d === ''))
                  ? 'bg-onyx-border text-gray-400 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-primary-gold-light to-primary-gold text-black hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                }
              `}
            >
              {isLoading ? <Loader2 className="animate-spin w-5 h-5 text-black" /> : 'Hakiki OTP'}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-400">Hujapata OTP? </span>
              <button
                onClick={handleResend}
                disabled={resendCountdown > 0 || isLoading}
                className={`font-semibold transition-colors
                  ${resendCountdown > 0 || isLoading
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-primary-gold hover:underline'
                  }
                `}
              >
                {isLoading && step === 'OTP' ? (
                  <Loader2 className="animate-spin w-4 h-4 inline" />
                ) : resendCountdown > 0 ? (
                  `Tuma tena baada ya ${resendCountdown}s`
                ) : (
                  'Tuma Tena'
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'PASSWORD' && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient-gold mb-2">Nywila Mpya</h2>
              <p className="text-gray-400 text-sm">
                Weka nywila yako mpya. Tafadhali kumbuka vizuri.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    {...pwForm.register('password')}
                    type={showPassword ? "text" : "password"}
                    placeholder="Nywila Mpya"
                    disabled={isLoading}
                    className="w-full bg-black/40 border border-onyx-border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {pwForm.formState.errors.password && (
                  <p className="text-error text-xs">{pwForm.formState.errors.password.message as string}</p>
                )}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <input
                    {...pwForm.register('confirmPassword')}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Thibitisha Nywila"
                    disabled={isLoading}
                    className="w-full bg-black/40 border border-onyx-border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {pwForm.formState.errors.confirmPassword && (
                  <p className="text-error text-xs">{pwForm.formState.errors.confirmPassword.message as string}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!pwForm.formState.isValid || isLoading}
                className={`w-full mt-6 py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center
                  ${(!pwForm.formState.isValid || isLoading)
                    ? 'bg-onyx-border text-gray-400 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-gold-light to-primary-gold text-black hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  }
                `}
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5 text-black" /> : 'Badili Nywila'}
              </button>
            </form>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-gold-light to-primary-gold rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Imefanikiwa!</h2>
            <p className="text-gray-400 mb-8">
              {requireManualLogin 
                ? "Nywila yako imebadilishwa kikamilifu. Tafadhali ingia kwa kutumia nywila mpya."
                : "Nywila yako imebadilishwa kikamilifu. Unapelekwa kwenye mfumo..."}
            </p>
            {requireManualLogin ? (
                <button
                onClick={onClose}
                className="w-full py-3.5 rounded-full font-semibold bg-onyx-border hover:bg-white/10 text-white transition-all duration-300"
                >
                Rudi Kuingia (Login)
                </button>
            ) : (
                <div className="flex justify-center mt-6">
                  <Loader2 className="animate-spin w-8 h-8 text-primary-gold" />
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}