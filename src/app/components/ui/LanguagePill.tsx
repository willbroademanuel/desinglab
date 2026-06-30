'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function LanguagePill() {
  const { lang, toggleLang } = useTranslation();
  const pathname = usePathname();
  const isOnHomepage = pathname.replace(/\/$/, '') === '/dashboard';

  const visibilityClass = isOnHomepage ? 'flex' : 'hidden md:flex';

  return (
    <button
      onClick={toggleLang}
      className={`items-center gap-1.5 bg-primary-gold/10 border border-primary-gold/30 hover:bg-primary-gold/20 hover:border-primary-gold/50 active:bg-primary-gold/30 transition-all px-2.5 py-1 rounded-full text-[10px] font-bold text-primary-gold uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-gold/50 select-none shrink-0 h-8 ${visibilityClass}`}
      aria-label="Toggle Language"
    >
      <Globe className="w-3.5 h-3.5 text-primary-gold" />
      <span>{lang === 'en' ? 'EN' : 'SW'}</span>
    </button>
  );
}
