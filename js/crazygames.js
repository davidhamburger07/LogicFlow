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

const SDK_SRC = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

let sdk = null;
let sdkPromise = null;
let desiredGameplay = false;   // does the current screen count as gameplay?
let gameplayOn = false;        // have we told the SDK gameplay is active?

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
      document.addEventListener('visibilitychange', applyGameplay);
    }
    return sdk;
  })();
  return sdkPromise;
}

export function getSdk() { return sdk; }

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
    try { if (sdk && sdk.game && sdk.game.gameplayStart) sdk.game.gameplayStart(); } catch (e) {}
    gameplayOn = true;
  } else if (!shouldPlay && gameplayOn) {
    try { if (sdk && sdk.game && sdk.game.gameplayStop) sdk.game.gameplayStop(); } catch (e) {}
    gameplayOn = false;
  }
}
