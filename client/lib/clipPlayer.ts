/**
 * One audio element for the whole session.
 *
 * iOS Safari grants playback permission per *element*, not per page. Every
 * card is keyed by track id, so React was building a brand-new <audio> for
 * each one — and each new element arrived locked, no matter how many clips
 * had already played. That is why nothing autoplayed on an iPhone.
 *
 * A single element, unlocked once by a real tap and then re-pointed at each
 * new clip, stays unlocked for the rest of the session.
 *
 * Deliberately nothing else here. An earlier version tried to spend a
 * "silent" play on page load to save the listener that first tap; it left
 * the element in an error state and paused clips as its promise settled,
 * which was far worse than the tap it was avoiding. The first clip of a
 * session needs one tap. That is the whole cost.
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
 * Points the player at a clip and starts it.
 *
 * play() is called synchronously — nothing is awaited before it — because
 * iOS only treats playback as user-initiated when it begins inside the
 * gesture handler itself. An await first would break the unlock.
 */
export function playClip(src: string): Promise<boolean> {
  const a = clipPlayer();
  if (!a) return Promise.resolve(false);

  if (a.src !== src) {
    a.src = src;
    // A previous source that failed to load is remembered, and blocks the
    // next play() until the element is reloaded.
    a.load();
  }

  return a.play().then(
    () => true,
    () => false
  );
}
