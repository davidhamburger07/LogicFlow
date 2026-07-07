// ============================================================
// create-checkout-session — Supabase Edge Function (Deno).
//
// Called by the signed-in client to buy a course. It identifies the user from
// their JWT, looks up the course's Stripe price server-side (the client never
// sends the price), and returns a Stripe Checkout URL. The webhook grants the
// entitlement after payment — never here.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY, SITE_URL
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-provided)
// ============================================================
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { course_id } = await req.json();
    if (!course_id) return json({ error: 'missing course_id' }, 400);

    // identify the caller from their JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: 'not authenticated' }, 401);

    // look up the course + its Stripe price with the service role
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: course } = await admin.from('courses').select('*').eq('id', course_id).single();
    if (!course || !course.published || !course.stripe_price_id) {
      return json({ error: 'course is not purchasable' }, 400);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    const site = Deno.env.get('SITE_URL') ?? '';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: course.stripe_price_id, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { user_id: user.id, course_id },
      success_url: `${site}/?unlocked=${encodeURIComponent(course_id)}`,
      cancel_url: `${site}/`,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
