/* ─────────────────────────────────────────────────────────────
   Pure Web Audio API 8-bit Synthesized Sound Engine
   Zero external audio files, ultra-low latency, retro chiptune sounds.
   - playSuccess()  : Melodic ascending C-E-G-C arpeggio
   - playLevelUp()  : Epic triumphant fanfare chord
   - playFlag()     : Victory retro synth blast
   - playClick()    : Subtle mechanical keyboard click
   - playBuzzer()   : Gentle descending boop
   - playStreak()   : Sparkle chime
   Respects getProfile().soundEnabled.
   ───────────────────────────────────────────────────────────── */

import { getProfile } from "./gamification";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
        /* autoplay policy blocked — will resume on next user gesture */
      });
    }
    return audioCtx;
  } catch (e) {
    console.warn("Web Audio API not supported or blocked:", e);
    return null;
  }
}

export function isAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return getProfile().soundEnabled;
  } catch {
    return true;
  }
}

/** Melodic ascending C-E-G-C arpeggio (C5, E5, G5, C6) */
export function playSuccess(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const startTime = ctx.currentTime;
  const noteDuration = 0.075;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // 8-bit square pulse warmth
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, startTime + i * noteDuration);

    // Warm chiptune low-pass filter
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, startTime + i * noteDuration);

    const noteStart = startTime + i * noteDuration;
    const noteEnd = noteStart + noteDuration;

    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteEnd);
  });
}

/** Epic triumphant fanfare chord (brass fanfare sequence + resonant major chord) */
export function playLevelUp(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime;

  // Intro rapid fanfare arpeggio: G4 -> C5 -> E5 -> G5
  const introNotes = [392.0, 523.25, 659.25, 783.99];
  introNotes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, startTime + idx * 0.08);

    const noteStart = startTime + idx * 0.08;
    const noteEnd = noteStart + 0.075;

    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.15, noteStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteEnd);
  });

  // Sustained glorious final chord: C5 + E5 + G5 + C6
  const chordTime = startTime + introNotes.length * 0.08 + 0.02;
  const chordNotes = [523.25, 659.25, 783.99, 1046.5];
  const chordDuration = 0.55;

  chordNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = i % 2 === 0 ? "square" : "triangle";
    osc.frequency.setValueAtTime(freq, chordTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, chordTime);

    gain.gain.setValueAtTime(0.001, chordTime);
    gain.gain.exponentialRampToValueAtTime(0.12, chordTime + 0.03);
    gain.gain.linearRampToValueAtTime(0.08, chordTime + chordDuration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + chordDuration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(chordTime);
    osc.stop(chordTime + chordDuration);
  });
}

/** Victory retro synth blast (pitch sweep power-up + resonant shimmer) */
export function playFlag(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.18); // Slide up to B5
  osc.frequency.setValueAtTime(1046.5, now + 0.19); // Snap to C6

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + 0.2);
  filter.Q.setValueAtTime(3.5, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.4);

  // Add trailing sparkling top harmonic
  const bell = ctx.createOscillator();
  const bellGain = ctx.createGain();
  bell.type = "sine";
  bell.frequency.setValueAtTime(1567.98, now + 0.18); // G6

  bellGain.gain.setValueAtTime(0.001, now + 0.18);
  bellGain.gain.exponentialRampToValueAtTime(0.12, now + 0.2);
  bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  bell.connect(bellGain);
  bellGain.connect(ctx.destination);
  bell.start(now + 0.18);
  bell.stop(now + 0.5);
}

/** Subtle mechanical keyboard click (short noise click + soft tactile tap) */
export function playClick(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // High snappy tap
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.015);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.02);
}

/** Gentle descending boop (two descending soft square tones) */
export function playBuzzer(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [220.0, 164.81]; // A3, E3
  const duration = 0.11;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now + idx * duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now + idx * duration);

    const noteStart = now + idx * duration;
    const noteEnd = noteStart + duration;

    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteEnd);
  });
}

/** Sparkle chime for streak increments & milestones */
export function playStreak(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [1046.5, 1318.51, 1567.98, 2093.0]; // C6, E6, G6, C7
  const delay = 0.055;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * delay);

    const noteStart = now + i * delay;
    const noteEnd = noteStart + 0.28;

    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteEnd);
  });
}
