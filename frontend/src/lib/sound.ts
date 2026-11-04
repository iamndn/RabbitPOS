/**
 * RabbitPOS Web Audio Engine
 * Lightweight, zero-latency synthesizer for POS operational audio feedback.
 * No external media files required; runs seamlessly on iOS Safari & Android Chrome.
 */

export type SoundEffectType = 'add' | 'remove' | 'checkout' | 'test';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundFeedbackEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem('rabbitpos_sound_feedback') !== 'false';
  } catch {
    return true;
  }
}

/**
 * Play an operational sound effect in RabbitPOS.
 * Respects the user's per-device setting (`rabbitpos_sound_feedback`).
 */
export function playPosSound(type: SoundEffectType = 'add', force: boolean = false): void {
  if (!force && !isSoundFeedbackEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  try {
    switch (type) {
      case 'add': {
        // High-pitched soft blip (700Hz -> 1050Hz, 60ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(1050, now + 0.06);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'remove': {
        // Soft lower drop blip (450Hz -> 320Hz, 50ms)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }

      case 'checkout': {
        // Cheerful triad chime: C5 (523Hz), E5 (659Hz), G5 (784Hz)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.09, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.18);
        });
        break;
      }

      case 'test': {
        // Dual preview beep
        const notes = [659.25, 880];
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.09, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.12);
        });
        break;
      }
    }
  } catch (err) {
    // Gracefully ignore audio synthesis errors
  }
}

