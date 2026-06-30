import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    // 1. Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins

    // 2. Store in our custom otp_verifications table
    const { error } = await supabase
      .from('otp_verifications')
      .upsert({ 
        phone, 
        otp_code: otpCode, 
        expires_at: expiresAt, 
        attempts: 0, 
        verified: false 
      }, { onConflict: 'phone' });

    if (error) throw error;

    // 3. Send SMS via your custom provider API
    // const smsApiKey = process.env.SMS_API_KEY;
    // await fetch("https://api.your-sms-provider.com/send", { ... });
    
    console.log(`[DEBUG] Sending OTP ${otpCode} to ${phone}`); // Remove in production

    return NextResponse.json({ success: true, message: "OTP sent" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
