import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return NextResponse.json({ error: "Phone and code required" }, { status: 400 });

    // 1. Verify custom OTP in database
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .single();

    if (fetchError || !otpRecord) throw new Error("OTP request not found");
    if (new Date(otpRecord.expires_at) < new Date()) throw new Error("OTP expired");
    if (otpRecord.attempts >= 5) throw new Error("Too many failed attempts");
    
    if (otpRecord.otp_code !== code) {
      await supabase.from('otp_verifications').update({ attempts: otpRecord.attempts + 1 }).eq('id', otpRecord.id);
      throw new Error("Invalid OTP");
    }

    // 2. Mark as verified
    await supabase.from('otp_verifications').update({ verified: true }).eq('id', otpRecord.id);

    // 3. Create or get user in Auth
    let { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: true
    });

    if (authError && authError.message.includes('already registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const user = existingUsers.users.find(u => u.phone === phone);
        if (!user) throw new Error("Could not fetch existing user");
        authData = { user };
    } else if (authError) {
        throw authError;
    }

    return NextResponse.json({ 
        success: true, 
        message: "Phone verified successfully",
        user: authData?.user
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
