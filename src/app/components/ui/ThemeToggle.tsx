'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  const isOnHomepage = pathname.replace(/\/$/, '') === '/dashboard';
  const isAuthPage = pathname.startsWith('/auth');
  const visibilityClass = (isOnHomepage || isAuthPage) ? 'flex' : 'hidden md:flex';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative items-center justify-center w-10 h-10 rounded-full bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:text-primary-gold hover:border-primary-gold transition-all duration-300 shadow-sm ${visibilityClass}`}
      aria-label="Toggle Theme"
    >
      {isDark ? (
        <Moon className="w-5 h-5 transition-transform duration-500 hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 transition-transform duration-500 hover:rotate-45" />
      )}
    </button>
  );
}
