// ============================================================
// config.js — deployment configuration.
//
// Fill these in for the STANDALONE SITE build. The anon key is a PUBLIC key
// (safe to ship — Row-Level Security protects the data). Leave them blank for
// local dev and the CrazyGames upload: the backend stays OFF and the game runs
// on the local entitlement provider (Computer Science free, no accounts).
// ============================================================

export const SUPABASE_URL = 'https://snhnmgkaaexoupepzint.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuaG5tZ2thYWV4b3VwZXB6aW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTMzOTIsImV4cCI6MjA5OTIyOTM5Mn0.BpQ83jfOWmuSgfwDxkNMUVh547O1yDflLrA98ciE2Tk';

// Accounts + paid courses turn on only when both keys are set. For the
// CrazyGames build, keep these blank so it stays free + ad-supported.
export function backendEnabled() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Embed the YouTube lesson videos. ON for the standalone site and local dev;
// the CrazyGames build sets this to false (build.mjs --crazygames), because the
// platform disallows external content/ads. The lessons teach the content on
// their own, so stripping the videos there loses no learning.
export const EMBED_VIDEOS = true;
