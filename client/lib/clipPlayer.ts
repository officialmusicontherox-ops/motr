/**
 * One audio element for the whole session.
 *
 * The feed used to render an <audio> inside each card. Since every card is
 * keyed by track id, React tore that element down and built a new one for
 * every swipe — and browsers grant permission to *play* per element, not per
 * page. So the silent unlock we performed on the first gesture applied to an
 * element that was immediately discarded, and each new card arrived locked
 * again. That's why nothing ever autoplayed, even after tapping play a
 * dozen times.
 *
 * A single element created once and merely re-pointed at each new clip stays
 * unlocked for the rest of the session.
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

/**
 * Spends a user gesture on the real player, so later programmatic play()
 * calls are permitted. Muted and immediately paused, so it's inaudible.
 */
export function primeClipPlayer(): void {
  const a = clipPlayer();
  if (!a) return;
  const wasMuted = a.muted;
  a.muted = true;
  void a
    .play()
    .then(() => {
      a.pause();
      a.muted = wasMuted;
    })
    .catch(() => {
      a.muted = wasMuted;
    });
}

/** Points the player at a clip and starts it. Resolves false if refused. */
export async function playClip(src: string): Promise<boolean> {
  const a = clipPlayer();
  if (!a) return false;
  if (a.src !== src) {
    a.src = src;
    a.currentTime = 0;
  }
  try {
    await a.play();
    return true;
  } catch {
    return false;
  }
}
