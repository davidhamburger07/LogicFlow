// ============================================================
// stripe-webhook — Supabase Edge Function (Deno).
//
// Stripe calls this after a payment. It verifies the signature, then (for a
// completed checkout) records the purchase and GRANTS the entitlement using the
// service role — the only path that writes entitlements, so a client can never
// grant itself a course.
//
// Deploy WITHOUT JWT verification (Stripe can't send a Supabase JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided)
// ============================================================
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch (e) {
    return new Response(`bad signature: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    const user_id = s.metadata?.user_id;
    const course_id = s.metadata?.course_id;
    if (user_id && course_id) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      // record the purchase (idempotent on the Stripe session id)
      await admin.from('purchases').upsert(
        { user_id, course_id, stripe_session_id: s.id, status: 'paid', amount: s.amount_total },
        { onConflict: 'stripe_session_id' },
      );
      // grant the entitlement (service role bypasses RLS; the only write path)
      await admin.from('entitlements').upsert(
        { user_id, course_id, source: 'purchase' },
        { onConflict: 'user_id,course_id' },
      );
    }
  }
  return new Response('ok', { status: 200 });
});
