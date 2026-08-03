/**
 * Unlocks audio playback without asking the listener to do anything.
 *
 * Browsers refuse to autoplay sound until the page has received a user
 * gesture. Rather than putting a "tap to play" wall in front of the first
 * card — work most people won't do, on a screen where the whole point is
 * that it just plays — we spend the first tap they make anywhere: a silent,
 * zero-length play/pause that satisfies the browser's requirement.
 *
 * After that every card autoplays for the rest of the session, which is what
 * someone opening a music app expects.
 */
let unlocked = false;

export function primeAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;

  try {
    const a = new Audio();
    a.muted = true;
    // A 1-sample silent wav: enough to count as playback, inaudible either way.
    a.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";
    void a.play().then(() => a.pause()).catch(() => {});
  } catch {
    // Nothing to do — the real play() call will still work once a gesture
    // lands, and the visible play button remains as a fallback.
  }
}

/** Listens once for the first gesture of the session, then gets out of the way. */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};

  const events = ["pointerdown", "touchstart", "keydown"] as const;
  const onFirst = () => {
    primeAudio();
    for (const e of events) window.removeEventListener(e, onFirst);
  };
  for (const e of events) window.addEventListener(e, onFirst, { passive: true });

  return () => {
    for (const e of events) window.removeEventListener(e, onFirst);
  };
}
