// ============================================================
// sound.js — Web Audio sound engine (no audio files).
// Lifted from the single-file build, now an ES module.
// Exports a single SFX object. DOM/volume-persistence concerns
// live in main.js; this module is pure audio.
// ============================================================

export const SFX = (() => {
  let ac = null, masterGain = null, vol = 0.7, muted = false;

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ac.createGain();
    masterGain.gain.value = vol;
    masterGain.connect(ac.destination);
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function tone({ freq = 440, type = 'sine', gain = 0.3, attack = 0.01, decay = 0.1, release = 0.15, duration = 0.25, detune = 0 } = {}) {
    if (muted) return;
    try {
      init(); resume();
      const osc = ac.createOscillator(), env = ac.createGain();
      osc.connect(env); env.connect(masterGain);
      osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
      const now = ac.currentTime;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + attack);
      env.gain.linearRampToValueAtTime(gain * 0.6, now + attack + decay);
      env.gain.linearRampToValueAtTime(0, now + duration + release);
      osc.start(now); osc.stop(now + duration + release + 0.05);
    } catch (e) {}
  }
  function seq(notes, gap = 0.08) {
    notes.forEach(([f, d, o], i) => setTimeout(() => tone({ freq: f, duration: d, ...(o || {}) }), i * gap * 1000));
  }
  function noise({ gain = 0.15, duration = 0.12, freq = 120, type = 'sawtooth' } = {}) {
    if (muted) return;
    try {
      init(); resume();
      const osc = ac.createOscillator(), filt = ac.createBiquadFilter(), env = ac.createGain();
      osc.connect(filt); filt.connect(env); env.connect(masterGain);
      osc.type = type; osc.frequency.value = freq;
      filt.type = 'bandpass'; filt.frequency.value = freq * 2; filt.Q.value = 0.5;
      const now = ac.currentTime;
      env.gain.setValueAtTime(gain, now); env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now); osc.stop(now + duration + 0.02);
    } catch (e) {}
  }

  return {
    setVol(v) { vol = v / 100; if (masterGain) masterGain.gain.value = muted ? 0 : vol; },
    toggleMute() { muted = !muted; if (masterGain) masterGain.gain.value = muted ? 0 : vol; return muted; },
    isMuted() { return muted; },
    powerOn() { seq([[110, .08, { type: 'square', gain: .12 }], [220, .08, { type: 'square', gain: .12 }], [440, .12, { type: 'square', gain: .15 }], [880, .18, { type: 'sine', gain: .18 }]], .07); },
    correct() { seq([[523, .06, { type: 'sine', gain: .22 }], [659, .06, { type: 'sine', gain: .22 }], [784, .14, { type: 'sine', gain: .25 }]], .07); },
    streakSound(n) { if (n === 3) seq([[392, .05], [523, .05], [659, .05], [784, .18, { gain: .28 }]], .06); else if (n === 5) seq([[523, .05], [659, .05], [784, .05], [1046, .05], [1318, .2, { gain: .28 }]], .055); else if (n >= 10) seq([[659, .04, { type: 'square', gain: .15 }], [784, .04, { type: 'square', gain: .15 }], [1046, .04, { type: 'square', gain: .15 }], [1318, .04, { type: 'square', gain: .15 }], [1568, .04, { type: 'square', gain: .15 }], [2093, .2, { gain: .25 }]], .05); },
    wrong() { noise({ gain: .18, duration: .18, freq: 90, type: 'sawtooth' }); setTimeout(() => noise({ gain: .12, duration: .14, freq: 70, type: 'sawtooth' }), 100); },
    bitClick(on) { tone({ freq: on ? 880 : 440, type: 'square', gain: .08, duration: .04, attack: .003, release: .04 }); },
    uiClick() { tone({ freq: 660, type: 'sine', gain: .1, duration: .05, attack: .003, release: .05 }); },
    phaseIntro() { seq([[220, .12, { type: 'sine', gain: .1, detune: -20 }], [330, .12, { type: 'sine', gain: .12 }], [440, .2, { type: 'sine', gain: .14, detune: 10 }]], .1); },
    phaseComplete() { seq([[523, .08], [659, .08], [784, .08], [1046, .08], [1318, .25, { gain: .25 }]], .09); },
    tick() { tone({ freq: 1200, type: 'sine', gain: .07, duration: .04, attack: .002, release: .04 }); },
    zap() { noise({ gain: .1, duration: .07, freq: 300, type: 'square' }); setTimeout(() => tone({ freq: 880, type: 'sine', gain: .09, duration: .05 }), 40); },
    gameOver() { seq([[440, .12, { type: 'square', gain: .2 }], [330, .12, { type: 'square', gain: .18 }], [220, .12, { type: 'square', gain: .15 }], [110, .3, { type: 'square', gain: .12 }]], .11); },
    hint() { tone({ freq: 528, type: 'sine', gain: .15, duration: .15, attack: .01, release: .12 }); },
    next() { tone({ freq: 330, type: 'sine', gain: .09, duration: .08, attack: .005, release: .08 }); },
  };
})();
