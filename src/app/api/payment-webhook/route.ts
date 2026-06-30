import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // IMPORTANT: Use Service Role Key here, not Anon Key
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    // 1. VERIFY SIGNATURE
    // Depending on your gateway (Paystack, Stripe, etc.), verify the request signature here.
    // const signature = req.headers.get("x-signature")
    // if (!isValidSignature(signature, payload)) throw new Error("Invalid signature")

    // 2. EXTRACT DETAILS (Adapt to your payment gateway's payload structure)
    // Example assumes payload contains metadata.user_id and amount in cents.
    const userId = payload.data?.metadata?.user_id;
    if (!userId) throw new Error("Missing user_id in payment metadata");

    const amountPaid = payload.data.amount / 100; // Convert cents to whole currency
    const reference = payload.data.reference || payload.data.id;

    // 3. CONVERT CURRENCY TO CREDITS (e.g., $1 = 10 credits)
    const creditsToAdd = Math.floor(amountPaid * 10);

    // 4. CALL THE RPC
    const { data, error } = await supabase.rpc('topup_credits', {
      p_user_id: userId,
      p_amount: creditsToAdd,
      p_type: 'purchase',
      p_idempotency_key: `payment_${reference}`,
      p_metadata: { provider: 'your-gateway', reference, amount: amountPaid }
    });

    if (error) {
      console.error("Topup error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, new_balance: data.new_balance }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
