/**
 * Unlocks audio playback without asking the listener to do anything.
 *
 * Browsers refuse to autoplay sound until the page has received a user
 * gesture. Rather than putting a "tap to play" wall in front of the first
 * card — work most people won't do, on a screen where the whole point is
 * that it just plays — we spend the first tap they make anywhere on a
 * silent play/pause of the shared player.
 *
 * After that every card autoplays for the rest of the session, which is what
 * someone opening a music app expects.
 */
import { primeClipPlayer } from "./clipPlayer";

let unlocked = false;

export function primeAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  // Must be the same element the feed plays through: permission is granted
  // per element, so priming a throwaway one achieves nothing.
  primeClipPlayer();
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
