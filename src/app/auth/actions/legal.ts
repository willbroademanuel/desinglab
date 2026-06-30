'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

/**
 * Accept legal document updates. Accepts both Terms of Use and Privacy Policy
 * in a single atomic operation to prevent the modal from looping.
 */
export async function acceptLegalUpdateAction(
  termsVersion: string,
  privacyVersion: string
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const userId = user.id;

    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');
    const userAgent = headersList.get('user-agent') || 'unknown';

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: 'Server configuration lacks administrative privileges.' };
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Log consent for BOTH documents atomically
    const { error: logError } = await supabaseAdmin
      .from('legal_consents_log')
      .insert([
        {
          user_id: userId,
          document_type: 'terms_of_use',
          version_accepted: termsVersion,
          ip_address: ipAddress,
          user_agent: userAgent
        },
        {
          user_id: userId,
          document_type: 'privacy_policy',
          version_accepted: privacyVersion,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      ]);

    if (logError) {
      console.error('[acceptLegalUpdateAction] Failed to log consent:', logError);
      return { success: false, error: 'Failed to record your consent securely.' };
    }

    // Update BOTH version fields on the profile in a single write
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        latest_terms_version: termsVersion,
        latest_privacy_version: privacyVersion
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[acceptLegalUpdateAction] Failed to update profile:', profileError);
      return { success: false, error: 'Failed to update your profile.' };
    }

    revalidatePath('/', 'layout');

    return { success: true };
  } catch (err: any) {
    console.error('[acceptLegalUpdateAction] Exception:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
