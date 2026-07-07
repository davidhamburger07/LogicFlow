// ============================================================
// config.js — deployment configuration.
//
// Fill these in for the STANDALONE SITE build. The anon key is a PUBLIC key
// (safe to ship — Row-Level Security protects the data). Leave them blank for
// local dev and the CrazyGames upload: the backend stays OFF and the game runs
// on the local entitlement provider (Computer Science free, no accounts).
// ============================================================

export const SUPABASE_URL = '';        // e.g. 'https://abcd1234.supabase.co'
export const SUPABASE_ANON_KEY = '';   // the project's public anon/publishable key

// Accounts + paid courses turn on only when both keys are set. For the
// CrazyGames build, keep these blank so it stays free + ad-supported.
export function backendEnabled() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
