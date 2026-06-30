import React from 'react';
import { X, LogOut, UserRound, Coins, Moon, Globe } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/app/components/ui/ThemeToggle';
import LanguagePill from '@/app/components/ui/LanguagePill';
import type { UserProfile } from '../index';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile;
}

export default function SettingsModal({ isOpen, onClose, userProfile }: SettingsModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const initials = userProfile?.username
    ? userProfile.username.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-sm bg-[color:var(--surface-1)]/80 backdrop-blur-2xl border border-[color:var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[color:var(--text-primary)]">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--surface-3)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Info Section */}
        <div className="p-6 border-b border-[color:var(--border-subtle)] flex flex-col items-center gap-3">
          {userProfile?.avatar_url ? (
            <img 
              src={userProfile.avatar_url} 
              alt={userProfile.username || 'User Avatar'} 
              className="w-16 h-16 rounded-full border-2 border-primary-gold object-cover shadow-sm"
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-primary-gold bg-[color:var(--surface-3)] flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-primary-gold">{initials}</span>
            </div>
          )}
          <div className="hidden w-16 h-16 rounded-full border-2 border-primary-gold bg-[color:var(--surface-3)] flex items-center justify-center shadow-sm">
            <span className="text-xl font-bold text-primary-gold">{initials}</span>
          </div>

          <div className="text-center">
            <h3 className="text-base font-bold text-[color:var(--text-primary)]">
              {userProfile?.username || 'Guest User'}
            </h3>
          </div>

          <div className="mt-2 flex items-center gap-2 bg-[color:var(--surface-2)]/50 px-4 py-2 rounded-xl border border-primary-gold/30">
            <Coins className="w-4 h-4 text-primary-gold" />
            <span className="text-sm font-bold text-[color:var(--text-secondary)]">
              {userProfile?.credits?.toLocaleString() ?? 0}
            </span>
            <span className="text-xs font-semibold text-primary-gold uppercase tracking-wider">
              CREDITS
            </span>
          </div>
        </div>

        {/* App Settings */}
        <div className="p-4 flex flex-col gap-2 border-b border-[color:var(--border-subtle)]">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[color:var(--surface-2)]/50 border border-[color:var(--border-subtle)] backdrop-blur-md">
            <div className="flex items-center gap-3 text-[color:var(--text-secondary)]">
              <Moon className="w-4 h-4" />
              <span className="text-sm font-semibold">Theme</span>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[color:var(--surface-2)]/50 border border-[color:var(--border-subtle)] backdrop-blur-md">
            <div className="flex items-center gap-3 text-[color:var(--text-secondary)]">
              <Globe className="w-4 h-4" />
              <span className="text-sm font-semibold">Language</span>
            </div>
            <LanguagePill />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4">
          <Link
            href="/m/logout"
            className="flex items-center justify-center gap-2 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-colors border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
