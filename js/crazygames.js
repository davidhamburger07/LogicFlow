// ============================================================
// crazygames.js — the single owner of the CrazyGames SDK.
//
// Loads + initialises the SDK once, and exposes the raw SDK plus guarded
// convenience calls for the events CrazyGames requires: loading start/stop
// and gameplay start/stop (the latter also gate ad timing). cloud.js reuses
// the same SDK instance for the user/data (cloud-save) modules.
//
// Off CrazyGames — local dev, the future standalone site, offline, or a
// blocked SDK — every call safely no-ops and the game runs normally. The
// real SDK only activates embedded on CrazyGames (or their QA tool); it is
// never fetched on localhost so dev stays clean and deterministic.
// ============================================================

import { SFX } from './sound.js';
import { MUSIC } from './music.js';

const SDK_SRC = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const AD_INTERVAL = 20 * 60 * 1000;   // show a midgame (interstitial) ad every 20 min of play

let sdk = null;
let sdkPromise = null;
let desiredGameplay = false;   // does the current screen count as gameplay?
let gameplayOn = false;        // have we told the SDK gameplay is active?
let playMs = 0;                // accumulated gameplay time since the last ad
let playStartedAt = 0;         // when the current gameplay stretch began
let adInProgress = false;
let priorMute = false;

function isLocalHost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '' || h === '[::1]';
}

function loadScript(timeout = 6000) {
  return new Promise(resolve => {
    if (window.CrazyGames && window.CrazyGames.SDK) return resolve(window.CrazyGames.SDK);
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve((window.CrazyGames && window.CrazyGames.SDK) || null); };
    const s = document.createElement('script');
    s.src = SDK_SRC; s.async = true;
    s.onload = finish;
    s.onerror = () => { if (!settled) { settled = true; resolve(null); } };
    document.head.appendChild(s);
    setTimeout(finish, timeout);
  });
}

// Load + init the SDK once. Resolves to the SDK object, or null off-platform.
export function initSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) sdk = window.CrazyGames.SDK;
      else if (!isLocalHost()) sdk = await loadScript();
      else sdk = null;
      if (sdk) { try { await sdk.init(); } catch (e) {} }
    } catch (e) { sdk = null; }
    if (sdk) {
      gameLoadingStart();
      applyPlatformMute();                                              // honour the site mute now…
      try { sdk.game.addSettingsChangeListener(applyPlatformMute); } catch (e) {}   // …and on every change
      document.addEventListener('visibilitychange', applyGameplay);
    }
    return sdk;
  })();
  return sdkPromise;
}

export function getSdk() { return sdk; }

// Mirror the CrazyGames site mute button onto our audio. Their `muteAudio`
// setting must take priority over the in-game mute, so it's applied as a
// separate override layer (SFX/MUSIC.setPlatformMute). No-op without the SDK.
function applyPlatformMute() {
  try {
    const m = !!(sdk && sdk.game && sdk.game.settings && sdk.game.settings.muteAudio);
    SFX.setPlatformMute(m);
    MUSIC.setPlatformMute(m);
  } catch (e) {}
}

// ---- required game events (all guarded; no-op without the SDK) ----
export function gameLoadingStart() { try { if (sdk && sdk.game && sdk.game.loadingStart) sdk.game.loadingStart(); } catch (e) {} }
export function gameLoadingStop()  { try { if (sdk && sdk.game && sdk.game.loadingStop)  sdk.game.loadingStop();  } catch (e) {} }
export function happytime()        { try { if (sdk && sdk.game && sdk.game.happytime)    sdk.game.happytime();    } catch (e) {} }

// The engine calls this from showScreen: true when the player is actively in a
// lesson or question, false on menus. Combined with tab visibility, so gameplay
// is reported as paused whenever the tab is hidden.
export function setGameplay(on) { desiredGameplay = !!on; applyGameplay(); }

function applyGameplay() {
  const shouldPlay = desiredGameplay && document.visibilityState !== 'hidden';
  if (shouldPlay && !gameplayOn) {
    playStartedAt = Date.now();
    try { if (sdk && sdk.game && sdk.game.gameplayStart) sdk.game.gameplayStart(); } catch (e) {}
    gameplayOn = true;
  } else if (!shouldPlay && gameplayOn) {
    if (playStartedAt) playMs += Date.now() - playStartedAt;   // banked play time
    try { if (sdk && sdk.game && sdk.game.gameplayStop) sdk.game.gameplayStop(); } catch (e) {}
    gameplayOn = false;
    maybeShowAd();   // this gameplay-off point is a natural break — the only place we interrupt
  }
}

// Show an interstitial once ~20 min of play has banked, and only at a break
// (leaving a lesson/question for a menu/results). CrazyGames also caps midgame
// ads to 1 per 3 min, so this never over-shows. No-op without the SDK.
function maybeShowAd() {
  if (playMs < AD_INTERVAL || adInProgress || !sdk || !sdk.ad || !sdk.ad.requestAd) return;
  adInProgress = true;
  try {
    sdk.ad.requestAd('midgame', {
      adStarted: () => { priorMute = SFX.isMuted(); SFX.setMuted(true); MUSIC.setMuted(true); },   // silence during the ad
      adFinished: () => { endAd(); },
      adError: () => { endAd(); },   // unfilled / cooldown — carry on, reset the timer
    });
  } catch (e) { endAd(); }
}
function endAd() { SFX.setMuted(priorMute); MUSIC.setMuted(priorMute); adInProgress = false; playMs = 0; }
