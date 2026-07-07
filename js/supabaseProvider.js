// ============================================================
// supabaseProvider.js — Supabase-backed auth + entitlements (standalone site).
//
// Loads supabase-js from the CDN (no build step) and fills the same entitlement
// provider contract as the local one: a SYNCHRONOUS ownedIds() over a cache
// that is refreshed asynchronously (on sign-in / auth changes / after a claim).
// Also exposes auth methods for the login UI, and claimFreeCourse() which calls
// the server-side, one-per-account grant function.
//
// Only loaded/initialised when config.backendEnabled() is true, so local dev and
// the CrazyGames build never touch the network or the CDN.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
let session = null;
let cachedOwned = [];
let freeUsed = false;
const authListeners = new Set();

async function getClient() {
  if (client) return client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// The entitlement provider handed to courses.setEntitlementProvider().
export const provider = {
  ownedIds() { return cachedOwned.slice(); },
  freeTokenUsed() { return freeUsed; },   // has this account already claimed its one free course?
};

export function currentUser() {
  if (!session || !session.user) return null;
  return { id: session.user.id, email: session.user.email, verified: !!session.user.email_confirmed_at };
}
export function onAuth(fn) { authListeners.add(fn); return () => authListeners.delete(fn); }
function emitAuth() { const u = currentUser(); authListeners.forEach(fn => { try { fn(u); } catch (e) {} }); }

async function refreshEntitlements() {
  try {
    if (!session) { cachedOwned = []; freeUsed = false; return; }
    const c = await getClient();
    const { data, error } = await c.from('entitlements').select('course_id, source');
    const rows = error ? [] : (data || []);
    cachedOwned = rows.map(r => r.course_id);
    freeUsed = rows.some(r => r.source === 'free_token');
  } catch (e) { cachedOwned = []; freeUsed = false; }
}
export function refresh() { return refreshEntitlements(); }

export async function initSupabase() {
  const c = await getClient();
  try { const { data } = await c.auth.getSession(); session = data.session || null; } catch (e) { session = null; }
  c.auth.onAuthStateChange((_event, s) => { session = s || null; refreshEntitlements().then(emitAuth); });
  if (session) await refreshEntitlements();
  emitAuth();
  return provider;
}

// ---- auth (for the login UI) ----
export async function signUp(email, password) {
  try { const c = await getClient(); const { error } = await c.auth.signUp({ email, password }); return { ok: !error, error: error && error.message }; }
  catch (e) { return { ok: false, error: 'Could not reach the server.' }; }
}
export async function signIn(email, password) {
  try { const c = await getClient(); const { error } = await c.auth.signInWithPassword({ email, password }); return { ok: !error, error: error && error.message }; }
  catch (e) { return { ok: false, error: 'Could not reach the server.' }; }
}
export async function signOut() {
  try { const c = await getClient(); await c.auth.signOut(); } catch (e) {}
}
export async function claimFreeCourse(courseId) {
  try {
    const c = await getClient();
    const { error } = await c.rpc('claim_free_course', { p_course_id: courseId });
    if (!error) await refreshEntitlements();
    return { ok: !error, error: error && error.message };
  } catch (e) { return { ok: false, error: 'Could not reach the server.' }; }
}

// Start a Stripe Checkout for a paid course. The Edge Function creates the
// session (server-side, with the price + user/course metadata); on success we
// redirect to Stripe. The webhook grants the entitlement after payment.
export async function startCheckout(courseId) {
  try {
    const c = await getClient();
    const { data, error } = await c.functions.invoke('create-checkout-session', { body: { course_id: courseId } });
    if (error || !data || !data.url) return { ok: false, error: (error && error.message) || 'Checkout is unavailable right now.' };
    window.location.href = data.url;
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Could not start checkout.' }; }
}
