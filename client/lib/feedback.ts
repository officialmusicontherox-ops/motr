/**
 * Swipe feedback: a short tone and a haptic tick at the moment of the decision.
 *
 * Synthesised with Web Audio rather than shipped as audio files. Two reasons:
 * a file costs a request and a cache miss on the one interaction that has to
 * feel instant, and a decoded file competes with the clip that is already
 * playing. These are a few dozen milliseconds of oscillator and cost nothing.
 *
 * The two sounds are deliberately asymmetric. Saving rises; passing is a
 * single low note that resolves immediately. Passing is not a failure and must
 * not sound like one, or people stop passing honestly to avoid the noise, and
 * an honest pass is the whole basis of the chart.
 */

import { clipPlayer } from "./clipPlayer";

const KEY = "motr_feedback";

/**
 * Drops the clip's volume for a moment so the cue can be heard.
 *
 * Raising the cue's gain alone does not work: it is competing with a track at
 * full volume through the same speaker, and anything loud enough to win that
 * fight is too loud to hear fifty times in a session. Ducking the music by
 * two thirds for a fifth of a second is the trick broadcast has always used,
 * and it is over before anyone registers the dip.
 */
function duck(): void {
  const a = clipPlayer();
  if (!a || a.paused) return;
  const original = a.volume;
  try {
    a.volume = Math.max(0, original * 0.3);
    window.setTimeout(() => {
      // Back up in steps, so the music returns rather than snapping back.
      let v = a.volume;
      const step = (original - v) / 5;
      const id = window.setInterval(() => {
        v = Math.min(original, v + step);
        try { a.volume = v; } catch { window.clearInterval(id); }
        if (v >= original - 0.001) {
          try { a.volume = original; } catch {}
          window.clearInterval(id);
        }
      }, 40);
    }, 190);
  } catch {
    // Some browsers refuse volume changes on a media element; the cue still
    // plays, just against the music.
  }
}

/** Shared across every swipe. Created on the first gesture, never before. */
let ctx: AudioContext | null = null;

/**
 * Browsers refuse an AudioContext that is not created inside a user gesture,
 * and a suspended one stays silent without reporting anything, so this is
 * called from the swipe handler itself rather than on mount.
 */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // resume() returns a promise, and a rejected promise is not caught by
    // the try/catch around it: that only sees synchronous throws. Chrome
    // rejects this when it refuses to start the context, which surfaced as
    // "Unhandled rejection: undefined" from a listener swiping on desktop.
    // Nothing useful can be done about a refusal, but it must not escape.
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

export function feedbackEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    // A private window can refuse storage. Defaulting to on matches what
    // someone who has never changed the setting expects.
    return true;
  }
}

export function setFeedbackEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Applies for this session even when it cannot be remembered.
  }
}

/**
 * One note. Gain is kept low on purpose: this plays over a song, and a cue
 * that competes with the music is a cue people turn off.
 */
function note(
  at: number,
  freq: number,
  durationSec: number,
  peak: number,
  type: OscillatorType = "sine"
): void {
  const c = ctx;
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  // Ramped rather than switched. A square edge on a gain node is an audible
  // click, which is exactly the cheap-sounding artefact this is trying to avoid.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationSec);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + durationSec + 0.02);
}

/**
 * Whether this is a device that can actually vibrate.
 *
 * Checking for `navigator.vibrate` is not enough: desktop Chrome and Firefox
 * both expose the method and silently do nothing, so the API's presence says
 * nothing about the hardware. A coarse pointer with no hover is the honest
 * test for a phone or tablet.
 */
function handheld(): boolean {
  try {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function canVibrate(): boolean {
  return typeof window !== "undefined" && handheld() && typeof navigator.vibrate === "function";
}

function buzz(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    // Android in practice. iOS Safari has no vibration API at all and no
    // polyfill worth having, so there the sound carries the feedback alone.
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw rather than returning false when blocked.
  }
}

/** Fired the instant a swipe is committed, before the network call. */
export function swipeFeedback(direction: "LEFT" | "RIGHT"): void {
  if (!feedbackEnabled()) return;
  duck();
  const c = audio();
  const now = c?.currentTime ?? 0;

  if (direction === "RIGHT") {
    // Up a fifth: the interval everything from a doorbell to a level-up uses
    // to say yes. Second note slightly louder so it reads as arriving.
    // Three notes rather than two, rising, and loud enough to be heard over
    // a track that is already playing. The first version sat at a gain of
    // 0.05 next to music at full volume, which made it a rumour.
    note(now, 587.33, 0.1, 0.20);
    note(now + 0.07, 880.0, 0.12, 0.26);
    note(now + 0.15, 1174.66, 0.2, 0.22);
    buzz([45, 55, 70]);
  } else {
    // Low, short, and over. Acknowledges the input without judging it.
    note(now, 196.0, 0.13, 0.15, "triangle");
    buzz(45);
  }
}
