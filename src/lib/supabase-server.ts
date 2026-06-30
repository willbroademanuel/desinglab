import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ==========================================
// SUPABASE SERVER CLIENT INITIALIZATION
// ==========================================
// This utility creates a Supabase client configured for Next.js Server Components,
// Server Actions, and Route Handlers. 

// Mobile Persistence — Cookie Policy:
// - maxAge: 365 days → cookies survive app close/swipe; never treated as session-only
// - SameSite=Lax    → works inside Android/iOS WebViews (Strict blocks them)
// - path: '/'       → cookie is sent on every request, not just the originating path
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Creates a Supabase client configured for Server usage.
 * It reads and writes cookies automatically to maintain user sessions.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                // Override to force persistent, WebView-compatible cookies
                maxAge: COOKIE_MAX_AGE,
                sameSite: 'lax',
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
              })
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
