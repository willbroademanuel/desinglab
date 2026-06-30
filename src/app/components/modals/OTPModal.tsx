'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<string | null>; // Returns error string or null on success
  onResend: () => Promise<string | null>; // Returns error string or null on success
}

export default function OTPModal({ isOpen, onClose, onVerify, onResend }: OTPModalProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(60);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setResendCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setError(null);
      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0 && isOpen) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown, isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
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
        handleVerify(newOtp.join(''));
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
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    // Extract only digits from the pasted text (handles things like " 123-456 " or "G-123456")
    const digits = pastedText.replace(/\D/g, '');
    
    if (!digits) return;

    const pastedData = digits.slice(0, 6).split('');
    const newOtp = [...otp];
    
    pastedData.forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    
    // Focus the next empty input or the last one
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6) {
      setError("Tafadhali ingiza tarakimu zote 6.");
      return;
    }
    
    setIsVerifying(true);
    setError(null);
    
    const err = await onVerify(code);
    if (err) {
      setError(err);
      setIsVerifying(false);
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    // If successful, onVerify will handle redirection, so we don't reset state here
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isResending) return;
    
    setIsResending(true);
    setError(null);
    
    const err = await onResend();
    if (err) {
      setError(err);
    } else {
      setResendCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    setIsResending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[color:var(--onyx)] backdrop-blur-2xl border border-[color:var(--onyx-border)] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
          disabled={isVerifying}
        >
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gradient-gold mb-2">Thibitisha Namba Yako</h2>
          <p className="text-[color:var(--text-secondary)] text-sm">
            TUMETUMA namba ya siri (OTP) kwenye simu yako. Tafadhali iweke hapa chini.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-error/50 text-error text-sm rounded-lg text-center animate-in slide-in-from-top-2">
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
              aria-label={`Cifre ${index + 1} la OTP`}
              pattern="\d*"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              className="w-10 h-12 sm:w-12 sm:h-14 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] rounded-xl text-center text-xl font-bold text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-primary-gold transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        <button
          onClick={() => handleVerify(otp.join(''))}
          disabled={isVerifying || otp.some(d => d === '')}
          className={`w-full py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center justify-center mb-4
            ${(isVerifying || otp.some(d => d === ''))
              ? 'bg-[color:var(--border-default)] text-[color:var(--text-tertiary)] cursor-not-allowed'
              : 'bg-gradient-to-r from-primary-gold-light to-primary-gold text-white hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
            }
          `}
        >
          {isVerifying ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : 'Thibitisha'}
        </button>

        <div className="text-center text-sm">
          <span className="text-[color:var(--text-secondary)]">Hujapata OTP? </span>
          <button
            onClick={handleResend}
            disabled={resendCountdown > 0 || isResending}
            className={`font-semibold transition-colors
              ${resendCountdown > 0 || isResending
                ? 'text-[color:var(--text-tertiary)] cursor-not-allowed'
                : 'text-primary-gold hover:underline'
              }
            `}
          >
            {isResending ? (
               <Loader2 className="animate-spin w-4 h-4 inline" />
            ) : resendCountdown > 0 ? (
               `Tuma tena baada ya ${resendCountdown}s`
            ) : (
               'Tuma Tena'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
