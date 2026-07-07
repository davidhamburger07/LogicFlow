// ============================================================
// music.js — generative ambient background music (no audio files).
//
// Matches the LOGICFLOW aesthetic: minimal, technical, calm. Three quiet
// layers over an A-minor-pentatonic palette — a breathing two-note drone
// (A + E, detuned sines), sparse long melody tones, and a rare high "signal
// blip" — scheduled a little ahead on a timer. Everything runs through one
// music bus + lowpass, well under the SFX level, so it never competes with
// feedback sounds. Pure WebAudio; keeps the bundle asset-free.
//
// main.js owns persistence/UI: starts it on the first user gesture (autoplay
// policy) when the setting is on, mirrors the volume slider + mute, and the
// ad layer mutes it during ads.
// ============================================================

export const MUSIC = (() => {
  const LEVEL = 0.16;               // music sits far below SFX (master fraction)
  const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 329.63]; // A2 pent + upper A/C/E
  let ac = null, bus = null, lp = null, droneOsc = [], droneGain = null, lfo = null;
  let timer = null, vol = 0.7, muted = false, playing = false;

  function gainNow() { return muted ? 0 : vol * LEVEL; }
  function applyGain(ramp = 0.6) {
    if (!bus) return;
    try { bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.linearRampToValueAtTime(gainNow(), ac.currentTime + ramp); } catch (e) {}
  }

  function note(freq, { type = 'triangle', peak = 0.5, attack = 1.0, hold = 1.2, release = 2.8, detune = 0 } = {}) {
    try {
      const osc = ac.createOscillator(), env = ac.createGain();
      osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
      osc.connect(env); env.connect(lp);
      const t = ac.currentTime + 0.05;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + attack);
      env.gain.setValueAtTime(peak, t + attack + hold);
      env.gain.linearRampToValueAtTime(0, t + attack + hold + release);
      osc.start(t); osc.stop(t + attack + hold + release + 0.1);
    } catch (e) {}
  }

  function tick() {
    if (!playing) return;
    // sparse melody: usually one soft tone, sometimes silence (space is the point)
    if (Math.random() < 0.62) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)];
      note(f, { peak: 0.35 + Math.random() * 0.2, detune: (Math.random() - 0.5) * 8 });
    }
    // rare high "signal blip" — a tiny circuit ping, very quiet
    if (Math.random() < 0.12) note(880 + [0, 100, 220][Math.floor(Math.random() * 3)], { type: 'sine', peak: 0.08, attack: 0.02, hold: 0.05, release: 0.6 });
  }

  function start() {
    if (playing) return;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        bus = ac.createGain(); bus.gain.value = 0;
        lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.4;
        lp.connect(bus); bus.connect(ac.destination);
        // the drone: A2 + E3, slightly detuned, breathing via a slow LFO
        droneGain = ac.createGain(); droneGain.gain.value = 0.16; droneGain.connect(lp);
        droneOsc = [[110, 3], [164.81, -4]].map(([f, d]) => {
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d;
          o.connect(droneGain); o.start(); return o;
        });
        lfo = ac.createOscillator(); lfo.frequency.value = 0.05;         // ~20 s breath
        const lfoAmp = ac.createGain(); lfoAmp.gain.value = 0.05;
        lfo.connect(lfoAmp); lfoAmp.connect(droneGain.gain); lfo.start();
      }
      if (ac.state === 'suspended') ac.resume();
      playing = true;
      applyGain(2.5);                                                    // slow fade in
      timer = setInterval(tick, 2600);
    } catch (e) { playing = false; }
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    try { bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8); } catch (e) {}
  }

  return {
    start, stop,
    isPlaying() { return playing; },
    setVol(v) { vol = Math.min(100, Math.max(0, Number(v) || 0)) / 100; if (playing) applyGain(0.3); },
    setMuted(m) { muted = !!m; if (playing) applyGain(0.3); },
    // for tests/diagnostics
    _state() { return { playing, muted, vol, acState: ac && ac.state, busGain: bus && bus.gain.value }; },
  };
})();
