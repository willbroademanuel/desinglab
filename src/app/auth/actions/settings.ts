'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function getAppSettingsAction() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .single();
    if (error) throw error;
    return { settings: data, success: true };
  } catch (err: any) {
    console.error('[getAppSettingsAction] Failed to retrieve settings:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to fetch settings' };
  }
}
