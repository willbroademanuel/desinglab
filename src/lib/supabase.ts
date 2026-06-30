import { createBrowserClient } from '@supabase/ssr'

// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================
// This utility file handles securely connecting to our Supabase database.
// Because Pixtrend uses Next.js 15 App Router, we need to carefully manage
// when we are calling Supabase on the "Client" vs the "Server".

/**
 * Creates a Supabase client configured for use in Client Components.
 * This should ONLY be used inside files that have 'use client' at the top.
 * It uses a singleton pattern behind the scenes to avoid creating multiple connections.
 * 
 * NOTE ON MOBILE PERSISTENCE: 
 * We use @supabase/ssr, which manages sessions via Cookies to keep Server 
 * and Client components synced. The persistent cookie settings (365 days, SameSite=Lax)
 * are handled in `lib/supabase-server.ts` and `proxy.ts`. 
 * DO NOT force `storage: localStorage` here, as it will break client-side auth state
 * and prevent features like the pricing badges from loading.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
