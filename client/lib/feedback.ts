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

const KEY = "motr_feedback";

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
    if (ctx.state === "suspended") void ctx.resume();
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
  const c = audio();
  const now = c?.currentTime ?? 0;

  if (direction === "RIGHT") {
    // Up a fifth: the interval everything from a doorbell to a level-up uses
    // to say yes. Second note slightly louder so it reads as arriving.
    note(now, 587.33, 0.1, 0.05);
    note(now + 0.075, 880.0, 0.16, 0.07);
    buzz([12, 28, 20]);
  } else {
    // Low, short, and over. Acknowledges the input without judging it.
    note(now, 174.61, 0.11, 0.045, "triangle");
    buzz(14);
  }
}
