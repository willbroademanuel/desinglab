'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function initiatePasswordReset(formData: FormData) {
  const rawPhone = formData.get('phone') as string;

  if (!rawPhone || !/^(06|07)\d{8}$/.test(rawPhone)) {
    return { error: 'Namba si sahihi (Invalid phone number format).' };
  }

  const phone = rawPhone.replace(/^0/, '255');
  const supabase = await createServerSupabaseClient();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Server configuration lacks administrative privileges.' };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone_number', rawPhone)
    .single();

  if (!existingProfile) {
    return { error: 'Hakuna akaunti yenye namba hii.' };
  }

  const { data: previousOtp } = await supabaseAdmin
    .from('otp_verifications')
    .select('expires_at')
    .eq('phone', phone)
    .single();

  if (previousOtp) {
    const expiresAt = new Date(previousOtp.expires_at).getTime();
    const generatedAt = expiresAt - (5 * 60 * 1000); 
    const secondsSinceGeneration = (Date.now() - generatedAt) / 1000;

    if (secondsSinceGeneration < 60) {
      return { error: 'Tafadhali subiri sekunde 60 kabla ya kuomba namba nyingine.' };
    }
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); 

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
    return { error: 'Imeshindwa kukuandalia namba ya siri. Jaribu tena.' };
  }

  const smsToken = process.env.NEXT_SMS_TOKEN;
  if (!smsToken) {
    return { error: 'Kosa la mfumo. SMS haiwezi kutumika sasa hivi.' };
  }

  const messageText = `Badili nywila Pixtrend OTP: ${otpCode}. Inatumika kwa dakika 5. Usimpe mtu yeyote.\n\n Tembelea tovuti yetu kwa maelezo zaidi: https://watulab.com`;
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
      return { error: 'Imeshindwa kutuma SMS. Hakikisha namba ipo hewani au jaribu tena baadaye.' };
    }
  } catch (err) {
    return { error: 'Kuna shida ya mtandao kufikia SMS.' };
  }

  return { success: true, formattedPhone: phone, originalPhone: rawPhone };
}

export async function validateResetOtp(formData: FormData) {
  const phone = formData.get('phone') as string;
  const otp = formData.get('otp') as string;

  if (!phone || !otp) return { error: 'Data hazijakamilika.' };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Server configuration lacks administrative privileges.' };
  }
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: otpData } = await supabaseAdmin.from('otp_verifications').select('*').eq('phone', phone).single();

  if (!otpData) return { error: 'Hakuna OTP iliyotumwa kwa namba hii.' };
  if (otpData.verified) return { error: 'OTP hii imeshatumika.' };
  if (new Date(otpData.expires_at) < new Date()) return { error: 'OTP ime-expire (zaidi ya dakika 5).' };
  if (otpData.attempts >= 3) return { error: 'Umekosea OTP mara nyingi sana. Omba nyingine.' };

  if (otpData.otp_code !== otp) {
    await supabaseAdmin.from('otp_verifications').update({ attempts: otpData.attempts + 1 }).eq('phone', phone);
    return { error: 'OTP si sahihi.' };
  }
  return { success: true };
}

export async function resetPasswordAction(formData: FormData) {
  const phone = formData.get('phone') as string; 
  const originalRawPhone = formData.get('originalPhone') as string;
  const otp = formData.get('otp') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!phone || !otp || !newPassword) {
    return { error: 'Data ulizoweka si sahihi.' };
  }

  if (newPassword.length < 8) {
    return { error: 'Nywila mpya lazima iwe na herufi kuanzia 8.' };
  }
  if (newPassword.length > 64) {
    return { error: 'Nywila ni ndefu mno.' };
  }
  if (!/[a-zA-Z]/.test(newPassword)) {
    return { error: 'Nywila lazima iwe na angalau herufi moja (A-Z, a-z).' };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing from ENV");
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

  if (fetchError || !otpData) return { error: 'Hakuna OTP iliyotumwa kwa namba hii.' };
  if (otpData.verified) return { error: 'OTP hii imeshatumika.' };
  if (new Date(otpData.expires_at) < new Date()) return { error: 'OTP ime-expire (zaidi ya dakika 5).' };
  if (otpData.attempts >= 3) return { error: 'Umekosea OTP mara nyingi sana. Omba nyingine.' };

  if (otpData.otp_code !== otp) {
    await supabaseAdmin.from('otp_verifications').update({ attempts: otpData.attempts + 1 }).eq('phone', phone);
    return { error: 'OTP si sahihi.' };
  }

  const { data: profileData } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone_number', originalRawPhone)
    .single();

  if (!profileData) {
    return { error: 'Akaunti haijulikani.' };
  }

  await supabaseAdmin.from('otp_verifications').update({ verified: true }).eq('phone', phone);

  const { error: adminUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
    profileData.id,
    { password: newPassword }
  );

  if (adminUpdateErr) {
    console.error("[Admin Update Error]:", adminUpdateErr.message);
    return { error: 'Imeshindwa kubadili nywila kwenye Authentication. Jaribu tena.' };
  }

  try {
    const syntheticEmail = `user_${originalRawPhone}@watulab.com`;
    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: newPassword,
    });

    if (signInError) {
      console.warn("[Auto-Login Error]:", signInError.message);
      return { success: true, requireManualLogin: true };
    }
  } catch (err) {
    console.warn("Unexpected error during auto log-in:", err);
  }

  return { success: true };
}
