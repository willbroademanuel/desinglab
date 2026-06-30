import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pixtrend AI | WatuLab",
  description: "Pixtrend AI — Premium AI image transformation platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // viewport-fit=cover activates env(safe-area-inset-*) inside Capacitor WebView.
  // Without this, the browser always returns 0px for safe area insets.
  viewportFit: "cover",
};

import NextTopLoader from 'nextjs-toploader';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import NavigationGuardProvider from '@/lib/providers/NavigationGuardProvider';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { cookies } from 'next/headers';
import type { Locale } from '@/locales';

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal?: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const initialLang: Locale = localeCookie === 'en' ? 'en' : 'sw';

  return (
    <html
      lang={initialLang}
      translate="no"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
        {/* Removed static color-scheme tags, next-themes will manage it dynamically */}
      </head>
      <body className="min-h-full font-[var(--font-inter)]">
        <NextTopLoader
          color="#FFD700"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #FFD700,0 0 5px #FFD700"
        />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <NavigationGuardProvider>
            <LanguageProvider initialLang={initialLang}>
              {children}
              {modal}
            </LanguageProvider>
          </NavigationGuardProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
