'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

const loginSchema = z.object({
  phone: z.string().regex(/^(06|07)\d{8}$/, 'Must be a valid TZ number (06/07XXXXXXXX)'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginAction(formData: FormData) {
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;

  const result = loginSchema.safeParse({ phone, password });
  if (!result.success) {
    return { error: 'Invalid form data. Please check your inputs.' };
  }

  const syntheticEmail = `user_${phone}@watulab.com`;

  const supabase = await createServerSupabaseClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (error) {
    console.error("[Login Error]:", error.message);
    // SECURITY: Don't leak whether the account exists or not.
    // Always return the same generic message for invalid credentials.
    return { error: 'Namba ya simu au nywila si sahihi. Tafadhali jaribu tena.' };
  }

  // Check account status
  if (authData?.user) {
    // Gatekeeper: Check if the user is restricted
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_restricted, role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.is_restricted && profile?.role !== 'admin') {
      return { success: true, restricted: true };
    }
  }

  // Instead of redirecting on the server which throws a redirect error that gets caught 
  // on the client, return success securely.
  return { success: true, restricted: false };
}
