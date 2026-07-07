// ============================================================
// cloud.js — CrazyGames cloud save.
//
// When the game runs on CrazyGames, this syncs the player's progress to
// their CrazyGames account so it follows them across devices. It layers on
// top of storage.js — localStorage stays the source of truth for the running
// session. On boot it hydrates local from the cloud for a signed-in user;
// it pushes the local snapshot back up when the player signs in, leaves the
// page, or after changes settle.
//
// Everything is guarded. Off CrazyGames (local dev, the future standalone
// site, offline, or a blocked/absent SDK) it silently no-ops and the game
// runs on localStorage alone. The save/restore CODE route (storage.js) works
// regardless — the two routes are independent.
//
// NOTE: the real cloud sync only runs embedded on CrazyGames (or their QA
// tool). Locally it stays in "unavailable / local-only" mode by design.
// ============================================================
import * as store from './storage.js';
import { initSdk } from './crazygames.js';

const CLOUD_KEY = 'logicflow.save';   // the single blob we store in the CrazyGames data module

let sdk = null;             // window.CrazyGames.SDK, once initialised (shared owner: crazygames.js)
let available = false;      // account/cloud features available (true only on CrazyGames)
let signedIn = false;
let user = null;
let lastSynced = '';        // data snapshot (no timestamp) last pushed — dedupes no-op syncs
const listeners = new Set();

export function getStatus() { return { available, signedIn, username: (user && user.username) || null }; }
export function onStatus(fn) { listeners.add(fn); try { fn(getStatus()); } catch (e) {} return () => listeners.delete(fn); }
function notify() { const s = getStatus(); listeners.forEach(fn => { try { fn(s); } catch (e) {} }); }

export async function initCloud() {
  try {
    // reuse the shared SDK (crazygames.js owns loading + init; null off-platform)
    sdk = await initSdk();
    if (!sdk) { notify(); return; }

    try { available = !!(await Promise.resolve(sdk.user.isUserAccountAvailable)); }
    catch (e) { available = false; }
    if (!available) { notify(); return; }

    try { user = await sdk.user.getUser(); } catch (e) { user = null; }
    signedIn = !!user;
    if (signedIn) hydrateFromCloud();

    try {
      sdk.user.addAuthListener(u => {
        user = u; signedIn = !!u;
        if (signedIn) { hydrateFromCloud(); syncUp(true); }
        notify();
      });
    } catch (e) {}

    // push progress up when the player leaves, plus a cheap deduped heartbeat
    const leave = () => syncUp();
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
    window.addEventListener('pagehide', leave);
    setInterval(() => syncUp(), 30000);

    notify();
  } catch (e) { /* any failure → stay local-only */ }
}

function cloudGetRaw(key) {
  try { const v = sdk.data.getItem(key); return (v && typeof v.then === 'function') ? null : v; }
  catch (e) { return null; }
}

// Cloud wins on load: apply the account's saved snapshot to localStorage.
function hydrateFromCloud() {
  try {
    const saved = cloudGetRaw(CLOUD_KEY);
    if (saved) {
      const res = store.importSave(saved);
      if (res && res.ok) lastSynced = JSON.stringify(store.snapshotState());
    }
  } catch (e) {}
}

// Push the local snapshot to the cloud (skips when unchanged, unless forced).
export function syncUp(force) {
  if (!available || !signedIn || !sdk) return;
  try {
    const dataStr = JSON.stringify(store.snapshotState());
    if (!force && dataStr === lastSynced) return;
    sdk.data.setItem(CLOUD_KEY, store.exportSave());
    lastSynced = dataStr;
  } catch (e) {}
}

// Open the CrazyGames sign-in prompt (only meaningful on CrazyGames).
export async function promptSignIn() {
  if (!available || !sdk) return getStatus();
  try {
    const u = await sdk.user.showAuthPrompt();
    if (u) { user = u; signedIn = true; hydrateFromCloud(); syncUp(true); notify(); }
  } catch (e) {}
  return getStatus();
}
