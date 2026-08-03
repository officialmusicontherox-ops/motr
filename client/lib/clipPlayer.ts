/**
 * One audio element for the whole session.
 *
 * The feed used to render an <audio> inside each card. Since every card is
 * keyed by track id, React tore that element down and built a new one for
 * every swipe — and browsers grant permission to *play* per element, not per
 * page. So each new card arrived locked no matter how many times the
 * previous one had been played.
 *
 * A single element, created once and merely re-pointed at each new clip,
 * stays unlocked for the rest of the session.
 */

let el: HTMLAudioElement | null = null;

export function clipPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio();
    el.preload = "auto";
  }
  return el;
}

/** A fraction of a second of silence, so priming has something real to play. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

/**
 * Spends a user gesture on the real player so later programmatic play()
 * calls are permitted.
 *
 * Two traps here, both of which produced a first card that appeared
 * completely dead:
 *
 *  - Calling play() with no source puts the element into an error state, and
 *    it then refuses a later, valid source until it is explicitly reloaded.
 *    So priming plays real (silent) audio rather than nothing.
 *  - The promise settles *after* the first card has already started its clip.
 *    Pausing or unmuting unconditionally at that point acts on the listener's
 *    music, not on the silence. Hence the guard: touch the element only if it
 *    is still sitting on the silent source.
 */
export function primeClipPlayer(): void {
  const a = clipPlayer();
  if (!a) return;
  if (a.src && !a.src.startsWith("data:")) return; // a real clip is already loaded

  a.muted = true;
  a.src = SILENT_WAV;

  const settle = () => {
    if (a.src.startsWith("data:")) {
      a.pause();
      a.muted = false;
    }
  };

  void a.play().then(settle).catch(settle);
}

/**
 * Points the player at a clip and starts it.
 *
 * load() matters: if a previous source failed — the priming call, or a dead
 * preview URL — the element holds onto that error and rejects the next
 * play() until it is reloaded.
 */
export async function playClip(src: string): Promise<boolean> {
  const a = clipPlayer();
  if (!a) return false;

  // Nothing is allowed to leave this muted: a silently-playing clip is
  // indistinguishable from a broken one.
  a.muted = false;

  if (a.src !== src) {
    a.src = src;
    a.load();
    a.currentTime = 0;
  }

  try {
    await a.play();
    return true;
  } catch {
    return false;
  }
}
