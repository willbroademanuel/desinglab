'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { headers } from 'next/headers';

const signupSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(64, 'Password must be at most 64 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  phone: z.string().regex(/^(06|07)\d{8}$/, 'Must be a valid TZ number (06/07XXXXXXXX)')
});

export async function initiateSignup(formData: FormData) {
  const password = formData.get('password') as string;
  const rawUsername = formData.get('username') as string;
  const rawPhone = formData.get('phone') as string;

  // Check if signups are globally disabled (Safe Failover Mode)
  try {
    const supabase = await createServerSupabaseClient();
    const { data: settings } = await supabase
      .from('app_settings')
      .select('block_signups')
      .maybeSingle();

    if (settings?.block_signups) {
      return { error: 'Usajili wa akaunti mpya umesitishwa kwa sasa. / New signups are temporarily disabled.' };
    }
  } catch (err) {
    console.error('[initiateSignup] Settings query failed:', err);
  }

  const result = signupSchema.safeParse({ password, username: rawUsername, phone: rawPhone });
  if (!result.success) {
    return { error: 'Invalid form data. Please check your inputs.' };
  }

  const phone = rawPhone.replace(/^0/, '255');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Server configuration lacks administrative privileges.' };
  }
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check 1: Look for existing profile with this phone number
  const { data: existingPhoneProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone_number', rawPhone)
    .maybeSingle();

  if (existingPhoneProfile) {
    return { error: 'Namba hii ya simu ilishasajiliwa Pixtrend.' };
  }

  let username = rawUsername;

  // Check if username is already taken in the profiles table
  const { data: existingUsernameProfile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existingUsernameProfile) {
    // Add 3 random digits to the username if it exists
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    username = `${rawUsername}${randomSuffix}`;
  }

  // SECURITY: Rate limit check to prevent SMS spam using the previous expiry timestamp
  const { data: previousOtp } = await supabaseAdmin
    .from('otp_verifications')
    .select('expires_at, attempts')
    .eq('phone', phone)
    .maybeSingle();

  if (previousOtp) {
    const expiresAt = new Date(previousOtp.expires_at).getTime();
    const generatedAt = expiresAt - (5 * 60 * 1000); // Back-calculate generation time
    const secondsSinceGeneration = (Date.now() - generatedAt) / 1000;

    if (secondsSinceGeneration < 60) {
      return { error: 'Tafadhali subiri sekunde 60 kabla ya kuomba namba nyingine (Spam Limit).' };
    }
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry

  // Upsert into otp_verifications using Admin client
  const { error: otpError } = await supabaseAdmin
    .from('otp_verifications')
    .upsert({
      phone: phone,
      otp_code: otpCode,
      expires_at: expiresAt,
      attempts: 0,
      verified: false
    }, { onConflict: 'phone' });

  if (otpError) {
    console.error("[OTP Database Error]:", otpError.message);
    return { error: 'Failed to generate OTP. Please try again later.' };
  }

  // Send SMS
  const smsToken = process.env.NEXT_SMS_TOKEN;
  if (!smsToken) {
    console.error("SMS token missing. Make sure NEXT_SMS_TOKEN is configured in .env.local.");
    return { error: 'System configuration error. SMS cannot be sent right now.' };
  }

  const messageText = `Karibu Pixtrend ,Namba ya uthibitisho (OTP): ${otpCode}. Usishiriki na mtu yeyote namba hii. Inafaa kutumika ndani ya dakika 5 tu, asante. \n\n Kama hukuomba OTP hii, tafadhali puuza ujumbe huu. \n Tembelea tovuti yetu kwa maelezo zaidi: https://watulab.com`;
  const reference = crypto.randomUUID();

  try {
    const smsRes = await fetch('https://messaging-service.co.tz/api/sms/v2/text/multi', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${smsToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        messages: [{
          from: process.env.NEXT_SMS_SENDER_ID || 'WatuLab',
          to: phone,
          text: messageText
        }],
        reference: reference
      })
    });

    if (!smsRes.ok) {
      const errorText = await smsRes.text();
      console.error("SMS Gateway Error:", errorText);
      return { error: 'Failed to send SMS. Please check your number or try again later.' };
    }
  } catch (err) {
    console.error("SMS Network Error:", err);
    return { error: 'Network error communicating with SMS provider.' };
  }

  return { success: true, processedUsername: username, formattedPhone: phone, originalPhone: rawPhone };
}

export async function verifyAndFinalizeSignup(formData: FormData) {
  const phone = formData.get('phone') as string; 
  const otp = formData.get('otp') as string;
  const password = formData.get('password') as string;
  const username = formData.get('username') as string;
  const originalRawPhone = formData.get('originalPhone') as string; 

  if (!phone || !otp || !password || !username || !originalRawPhone) {
    return { error: 'Missing required data for verification.' };
  }

  if (!/^\d{6}$/.test(otp)) {
    return { error: 'OTP lazima iwe tarakimu 6 tu.' };
  }

  if (!/^255(6|7)\d{8}$/.test(phone)) {
    return { error: 'Namba ya simu si sahihi.' };
  }

  const supabase = await createServerSupabaseClient();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Server configuration lacks administrative privileges.' };
  }
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: otpData, error: fetchError } = await supabaseAdmin
    .from('otp_verifications')
    .select('*')
    .eq('phone', phone)
    .single();

  if (fetchError || !otpData) {
    return { error: 'No OTP requested for this number.' };
  }

  if (otpData.verified) {
    return { error: 'This phone number has already been verified.' };
  }

  if (new Date(otpData.expires_at) < new Date()) {
    return { error: 'OTP has expired. Please request a new one.' };
  }

  if (otpData.attempts >= 3) {
    return { error: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (otpData.otp_code !== otp) {
    await supabaseAdmin.from('otp_verifications').update({ attempts: otpData.attempts + 1 }).eq('phone', phone);
    return { error: 'Invalid OTP code.' };
  }

  await supabaseAdmin.from('otp_verifications').update({ verified: true }).eq('phone', phone);

  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');
  const userAgent = headersList.get('user-agent') || 'unknown';
  const consentTimestamp = new Date().toISOString();

  const { data: appSettings } = await supabaseAdmin
    .from('app_settings')
    .select('active_terms_version, active_privacy_version')
    .eq('id', 1)
    .single();

  const termsVersion = appSettings?.active_terms_version || '1.0.0';
  const privacyVersion = appSettings?.active_privacy_version || '1.0.0';

  const syntheticEmail = `user_${originalRawPhone}@watulab.com`;

  try {
    const { data: adminData, error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: username,
        phone_number: originalRawPhone
      }
    });

    if (error) {
      console.error("[Supabase Auth Error]:", error.message);
      if (error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('duplicate')) {
        return { error: 'Namba hii ya simu imeshajisajili. Tafadhali ingia kwa akaunti yako.' };
      }
      return { error: `Imeshindwa kutengeneza akaunti: ${error.message}` };
    }

    // After admin creates the user, we need to sign them in so they get a session cookie
    if (adminData.user) {
      await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: password
      });

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          username: username,
          phone_number: originalRawPhone,
          consent_ip_address: ipAddress,
          consent_timestamp: consentTimestamp,
          latest_terms_version: termsVersion,
          latest_privacy_version: privacyVersion
        })
        .eq('id', adminData.user.id);

      if (profileError) {
        console.warn("Could not update profile immediately:", profileError);
      } else {
        await supabaseAdmin
          .from('legal_consents_log')
          .insert([
            {
              user_id: adminData.user.id,
              document_type: 'terms_of_use',
              version_accepted: termsVersion,
              ip_address: ipAddress,
              user_agent: userAgent
            },
            {
              user_id: adminData.user.id,
              document_type: 'privacy_policy',
              version_accepted: privacyVersion,
              ip_address: ipAddress,
              user_agent: userAgent
            }
          ]);
      }
    }
  } catch (err: any) {
    console.error("[Signup Exception]:", err);
    return { error: "An unexpected error occurred during final signup." };
  }

  return { success: true };
}

export async function markWelcomeGiftSeenAction(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('mark_welcome_modal_seen', { p_user_id: userId });
  if (error) {
    console.error("Failed to mark welcome modal seen:", error);
  }
}
