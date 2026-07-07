// ============================================================
// courses.js — the GCSE course catalog + the entitlement layer.
//
// The game began as a single GCSE Computer Science course; this turns it into
// a catalog. On the standalone site each account gets ONE course free (its
// "free token"); more are a one-time unlock. Computer Science is the only
// course actually built so far — the rest appear locked / coming soon.
//
// Entitlements go through a PROVIDER so the source can be swapped without
// touching the UI: a LOCAL provider now (dev + the free CrazyGames build), a
// Supabase provider on the standalone site later. NOTHING here is a security
// boundary — real enforcement is server-side (Supabase RLS + server-delivered
// content). This layer just decides what the Courses screen shows.
// ============================================================

import * as store from './storage.js';

export const FREE_COURSE_ID = 'compsci';   // the base course — always available
export const UNLOCK_PRICE = '£2.99';       // placeholder one-time price (the real price is set server-side)

// The GCSE catalog. `built: true` means the course actually has content and is
// playable; the rest are placeholders that show as locked until they're built
// AND owned. Kept broad so every GCSE subject appears as a future option.
export const COURSES = [
  { id: 'compsci', name: 'Computer Science', icon: '💻', built: true },
  { id: 'maths', name: 'Mathematics', icon: '📐', built: false },
  { id: 'statistics', name: 'Statistics', icon: '📊', built: false },
  { id: 'combined-science', name: 'Combined Science', icon: '🔬', built: false },
  { id: 'biology', name: 'Biology', icon: '🧬', built: false },
  { id: 'chemistry', name: 'Chemistry', icon: '⚗️', built: false },
  { id: 'physics', name: 'Physics', icon: '🔭', built: false },
  { id: 'english-language', name: 'English Language', icon: '✍️', built: false },
  { id: 'english-literature', name: 'English Literature', icon: '📖', built: false },
  { id: 'history', name: 'History', icon: '🏛️', built: false },
  { id: 'geography', name: 'Geography', icon: '🌍', built: false },
  { id: 'french', name: 'French', icon: '🥖', built: false },
  { id: 'spanish', name: 'Spanish', icon: '💃', built: false },
  { id: 'german', name: 'German', icon: '🥨', built: false },
  { id: 'religious-studies', name: 'Religious Studies', icon: '☮️', built: false },
  { id: 'business', name: 'Business', icon: '📈', built: false },
  { id: 'economics', name: 'Economics', icon: '💷', built: false },
  { id: 'psychology', name: 'Psychology', icon: '🧠', built: false },
  { id: 'sociology', name: 'Sociology', icon: '👥', built: false },
  { id: 'art-design', name: 'Art & Design', icon: '🎨', built: false },
  { id: 'music', name: 'Music', icon: '🎵', built: false },
  { id: 'drama', name: 'Drama', icon: '🎭', built: false },
  { id: 'pe', name: 'Physical Education', icon: '🏃', built: false },
  { id: 'design-technology', name: 'Design & Technology', icon: '🔧', built: false },
  { id: 'food', name: 'Food Prep & Nutrition', icon: '🍳', built: false },
  { id: 'media', name: 'Media Studies', icon: '🎬', built: false },
];

export function getCourse(id) { return COURSES.find(c => c.id === id) || null; }

// ---- entitlement provider (swap for a Supabase provider on the standalone site) ----
// Contract: ownedIds() -> string[] of owned course ids.
const localProvider = {
  ownedIds() {
    const owned = new Set(store.getOwnedCourses());
    owned.add(FREE_COURSE_ID);   // the base course is free everywhere
    return [...owned];
  },
};
let provider = localProvider;
export function setEntitlementProvider(p) { provider = (p && typeof p.ownedIds === 'function') ? p : localProvider; }

export function ownsCourse(id) { return provider.ownedIds().includes(id); }

// Has this account already spent its one free course? (false without a backend.)
export function freeTokenUsed() { return typeof provider.freeTokenUsed === 'function' ? !!provider.freeTokenUsed() : false; }

// What the Courses screen should show for a card:
//   'play'   — owned + built (you can play it now)      → Computer Science
//   'owned'  — owned but not built yet
//   'locked' — built but not owned (a real unlock/buy)  → (future paid courses)
//   'soon'   — not built yet (a placeholder subject)    → every other subject for now
export function courseState(course) {
  const owned = ownsCourse(course.id);
  if (course.built) return owned ? 'play' : 'locked';
  return owned ? 'owned' : 'soon';
}

// ---- active course (which course you're currently playing) ----
export function getActiveCourseId() {
  const id = store.getActiveCourse();
  return (id && ownsCourse(id) && (getCourse(id) || {}).built) ? id : FREE_COURSE_ID;
}
export function setActiveCourse(id) { const c = getCourse(id); if (c && c.built && ownsCourse(id)) store.setActiveCourse(id); }
