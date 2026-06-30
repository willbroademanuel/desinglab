import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Add Cross-Origin isolation for the Photo Background Studio
        // This is a professional step to enable WebAssembly multi-threading for the imgly engine.
        source: '/dashboard/designer-hub/photo-background-studio',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        // Add Cross-Origin isolation for Portrait Mode (also uses WASM)
        source: '/dashboard/designer-hub/portrait-mode',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: [
      // Supabase Storage — restrict to your project's domain
      // SECURITY: Never use hostname: '**' — it creates an SSRF vector
      // via the Next.js Image Optimization proxy.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
    // Performance: prefer modern formats and limit generated sizes
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
