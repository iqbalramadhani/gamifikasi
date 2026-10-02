import { state } from './state.js';

let audioCtx = null;
let bgmGainNode = null;
let sfxGainNode = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      bgmGainNode = audioCtx.createGain();
      sfxGainNode = audioCtx.createGain();

      bgmGainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
      sfxGainNode.gain.setValueAtTime(0.6, audioCtx.currentTime);

      bgmGainNode.connect(audioCtx.destination);
      sfxGainNode.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Convert MIDI note number to frequency in Hz */
const m2f = m => (m <= 0 ? 0 : 440 * Math.pow(2, (m - 69) / 12));

/**
 * Play synthesized sound effects
 */
export function playSound(type) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(sfxGainNode || ctx.destination);

  if (type === 'shoot') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.18);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1600, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'dash') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(650, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'spin') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'boss_spawn') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(180, now + 2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 2.5);
    osc.start(now);
    osc.stop(now + 2.5);
  } else if (type === 'footstep') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'rest') {
    // Calming 4-note ascending harp arpeggio (C4 -> E4 -> G4 -> C5)
    const notes = [60, 64, 67, 72];
    notes.forEach((note, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(m2f(note), now + idx * 0.18);
      g.gain.setValueAtTime(0.18, now + idx * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.8);
      o.connect(g);
      g.connect(sfxGainNode || ctx.destination);
      o.start(now + idx * 0.18);
      o.stop(now + idx * 0.18 + 0.8);
    });
  } else if (type === 'splash') {
    // Water droplet sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'cluck') {
    // Chicken cluck
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'bark') {
    // Dog friendly bark
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'bird') {
    // Sweet chirping bird
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.linearRampToValueAtTime(3100, now + 0.05);
    osc.frequency.linearRampToValueAtTime(2600, now + 0.1);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

// ─── Procedural Multi-Track RPG BGM Sequencer ─────────────────────────────────

// Track definitions
// step length = 0.24s (approx 125 BPM 16th notes or 62.5 BPM 8th notes)
const TRACKS = {
  hometown: {
    tempo: 105,
    bars: 32,
    // Warm acoustic lute arpeggios + flute melody
    bass: [
      36, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 47, 0, 0, 0,
      45, 0, 0, 0, 48, 0, 0, 0, 41, 0, 0, 0, 45, 0, 0, 0,
    ],
    chords: [
      60, 64, 67, 72, 60, 64, 67, 72, 59, 62, 67, 71, 59, 62, 67, 71,
      60, 64, 69, 72, 60, 64, 69, 72, 60, 65, 69, 72, 60, 65, 69, 72,
    ],
    melody: [
      72, 0, 74, 76, 79, 0, 76, 74, 72, 74, 72, 0, 67, 0, 69, 72,
      76, 0, 79, 81, 79, 76, 74, 0, 72, 0, 74, 72, 69, 0, 72, 0,
    ],
    type: 'peaceful',
  },
  wilds: {
    tempo: 92,
    bars: 32,
    // Ethereal mystical forest pads and chime arpeggios
    bass: [
      33, 0, 0, 0, 45, 0, 0, 0, 38, 0, 0, 0, 50, 0, 0, 0,
      41, 0, 0, 0, 53, 0, 0, 0, 40, 0, 0, 0, 52, 0, 0, 0,
    ],
    chords: [
      57, 60, 64, 69, 0, 64, 69, 72, 57, 62, 65, 69, 0, 65, 69, 74,
      57, 60, 65, 69, 0, 65, 69, 72, 55, 59, 64, 67, 0, 64, 67, 71,
    ],
    melody: [
      69, 0, 0, 72, 71, 0, 69, 0, 65, 0, 67, 69, 64, 0, 0, 0,
      69, 0, 72, 76, 74, 0, 72, 69, 67, 0, 69, 71, 69, 0, 0, 0,
    ],
    type: 'mystical',
  },
  wilds2: {
    tempo: 112,
    bars: 32,
    // Desert exotic Phrygian dominant scale
    bass: [
      38, 0, 38, 0, 50, 0, 38, 0, 39, 0, 39, 0, 51, 0, 39, 0,
      42, 0, 42, 0, 54, 0, 42, 0, 38, 0, 38, 0, 50, 0, 38, 0,
    ],
    chords: [
      62, 66, 69, 72, 62, 66, 69, 72, 63, 66, 69, 74, 63, 66, 69, 74,
      66, 69, 72, 78, 66, 69, 72, 78, 62, 66, 69, 72, 62, 66, 69, 72,
    ],
    melody: [
      74, 75, 74, 71, 69, 71, 74, 0, 75, 77, 75, 74, 71, 0, 74, 0,
      78, 77, 75, 74, 71, 74, 75, 0, 74, 71, 69, 71, 62, 0, 0, 0,
    ],
    type: 'desert',
  },
  boss: {
    tempo: 136,
    bars: 32,
    // Intense driving battle theme with galloping bassline
    bass: [
      38, 38, 50, 38, 38, 38, 50, 38, 41, 41, 53, 41, 41, 41, 53, 41,
      43, 43, 55, 43, 43, 43, 55, 43, 40, 40, 52, 40, 39, 39, 51, 39,
    ],
    chords: [
      62, 65, 69, 74, 62, 65, 69, 74, 65, 68, 72, 77, 65, 68, 72, 77,
      67, 70, 74, 79, 67, 70, 74, 79, 64, 67, 71, 76, 63, 66, 70, 75,
    ],
    melody: [
      74, 0, 74, 77, 76, 74, 72, 74, 77, 0, 79, 81, 79, 77, 76, 0,
      79, 0, 79, 81, 82, 81, 79, 77, 76, 74, 76, 77, 74, 0, 0, 0,
    ],
    type: 'boss',
  },
};

let currentTrackKey = null;
let currentStep = 0;
let nextNoteTime = 0;
let isBgmRunning = false;
let bgmIntervalId = null;
let birdChirpTimer = 0;

function scheduleStep(track, time) {
  const ctx = getAudioContext();
  if (!ctx || !bgmGainNode) return;

  const stepDur = 60 / track.tempo / 2; // eighth note duration

  // 1. Play Bass Note
  const bassMidi = track.bass[currentStep % track.bars];
  if (bassMidi > 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = track.type === 'boss' ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(m2f(bassMidi), time);
    g.gain.setValueAtTime(track.type === 'boss' ? 0.08 : 0.12, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.5);
    o.connect(g);
    g.connect(bgmGainNode);
    o.start(time);
    o.stop(time + stepDur * 1.5);
  }

  // 2. Play Arpeggio / Chord Note
  const chordMidi = track.chords[currentStep % track.bars];
  if (chordMidi > 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = track.type === 'desert' ? 'sawtooth' : 'sine';
    o.frequency.setValueAtTime(m2f(chordMidi), time);
    g.gain.setValueAtTime(0.06, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.8);
    o.connect(g);
    g.connect(bgmGainNode);
    o.start(time);
    o.stop(time + stepDur * 1.8);
  }

  // 3. Play Lead Melody Note
  const melodyMidi = track.melody[currentStep % track.bars];
  if (melodyMidi > 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = track.type === 'boss' ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(m2f(melodyMidi), time);
    g.gain.setValueAtTime(track.type === 'boss' ? 0.07 : 0.09, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 2.2);
    o.connect(g);
    g.connect(bgmGainNode);
    o.start(time);
    o.stop(time + stepDur * 2.2);
  }

  // 4. Ambient percussion in Boss & Desert tracks
  if (track.type === 'boss') {
    if (currentStep % 4 === 0) {
      // Kick drum
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, time);
      o.frequency.exponentialRampToValueAtTime(30, time + 0.1);
      g.gain.setValueAtTime(0.18, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      o.connect(g);
      g.connect(bgmGainNode);
      o.start(time);
      o.stop(time + 0.1);
    } else if (currentStep % 4 === 2) {
      // Snare tap
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(260, time);
      o.frequency.exponentialRampToValueAtTime(90, time + 0.07);
      g.gain.setValueAtTime(0.09, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
      o.connect(g);
      g.connect(bgmGainNode);
      o.start(time);
      o.stop(time + 0.07);
    }
  }

  currentStep = (currentStep + 1) % track.bars;
}

function bgmScheduler() {
  const ctx = getAudioContext();
  if (!ctx || !isBgmRunning) return;

  const s = state;
  // Determine desired track based on state
  let desiredKey = 'hometown';
  if (s.bossActive && s.currentScene !== 'hometown') {
    desiredKey = 'boss';
  } else if (s.currentScene === 'wilds2') {
    desiredKey = 'wilds2';
  } else if (s.currentScene === 'wilds') {
    desiredKey = 'wilds';
  }

  if (desiredKey !== currentTrackKey) {
    currentTrackKey = desiredKey;
    currentStep = 0;
  }

  const track = TRACKS[currentTrackKey] || TRACKS.hometown;
  const stepDur = 60 / track.tempo / 2;

  // Look-ahead schedule up to 0.15s ahead
  while (nextNoteTime < ctx.currentTime + 0.15) {
    scheduleStep(track, nextNoteTime);
    nextNoteTime += stepDur;
  }

  // Occasional ambient bird in Hometown
  if (s.currentScene === 'hometown' && !s.bossActive) {
    birdChirpTimer++;
    if (birdChirpTimer > 90) { // roughly every 7-8 seconds
      birdChirpTimer = 0;
      if (Math.random() < 0.7) playSound('bird');
    }
  }
}

export function startBGM() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (isBgmRunning) return;

  isBgmRunning = true;
  state.bgmStarted = true;
  nextNoteTime = ctx.currentTime + 0.05;
  currentStep = 0;

  if (bgmIntervalId) clearInterval(bgmIntervalId);
  bgmIntervalId = setInterval(bgmScheduler, 45);

  updateBgmButtonUI();
}

export function stopBGM() {
  isBgmRunning = false;
  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
  updateBgmButtonUI();
}

export function toggleBGM() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (isBgmRunning) {
    stopBGM();
    state.bgmEnabled = false;
  } else {
    state.bgmEnabled = true;
    startBGM();
  }
  updateBgmButtonUI();
}

export function setBGMVolume(val) {
  if (bgmGainNode && audioCtx) {
    const clamped = Math.max(0, Math.min(1, val));
    bgmGainNode.gain.setValueAtTime(clamped, audioCtx.currentTime);
  }
}

export function updateBgmButtonUI() {
  const btn = document.getElementById('btn-toggle-bgm');
  if (btn) {
    btn.innerHTML = isBgmRunning ? '🎵 Musik: ON' : '🔇 Musik: OFF';
    btn.style.opacity = isBgmRunning ? '1' : '0.65';
  }
}

window.toggleBGM = toggleBGM;
window.setBGMVolume = setBGMVolume;

// Resume / Start on first user interaction
window.addEventListener('pointerdown', () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (state.bgmEnabled !== false && !isBgmRunning) {
    startBGM();
  }
}, { once: true });
