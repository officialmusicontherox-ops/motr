"use client";

import { useEffect, useRef, useState } from "react";
import MotrShell from "./MotrShell";
import SwipeCard from "./SwipeCard";
import SponsoredCard from "./SponsoredCard";
import SaveEmailPrompt, { savePromptDismissed } from "./SaveEmailPrompt";
import GenrePicker from "./GenrePicker";
import { Disc, Note, Seal } from "./icons";
import Equalizer from "./Equalizer";
import type { Fan, Track } from "@/lib/types";
import { bumpSavedCount, savedTotal } from "@/lib/savedCount";
import { saveMoment } from "@/lib/saveMoment";
import { newlyEarned } from "@/lib/badgeNotices";

const AI_KEY = "motr_allow_ai";
const GENRE_KEY = "motr:genre";

type FeedResponse = {
  track: Track | null;
  genreExhausted?: boolean;
  othersAvailable?: number;
  fromShare?: boolean;
};

async function fetchNextTrack(
  genre: string | null,
  allowAi: boolean,
  startWith?: string | null
): Promise<FeedResponse> {
  // No fan id: the server reads the session cookie.
  const q = new URLSearchParams();
  if (genre) q.set("genre", genre);
  if (!allowAi) q.set("ai", "0");
  if (startWith) q.set("track", startWith);
  const res = await fetch(`/api/discover/next?${q}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** A shared link's track, from the URL or stashed by the sign-in screen. */
function takeSharedTrack(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("track");
  const stashed = sessionStorage.getItem("motr:sharedTrack");
  const id = fromUrl ?? stashed;
  if (fromUrl) window.history.replaceState({}, "", window.location.pathname);
  // Consumed once — a refresh shouldn't replay the same track forever.
  sessionStorage.removeItem("motr:sharedTrack");
  return id;
}

/**
 * How often an ad card comes up.
 *
 * Counted in swipes rather than in time, so someone who plays every clip
 * through sees exactly as many ads as someone who skips fast — the listener
 * giving artists the most attention isn't the one shown the most adverts.
 */
const SWIPES_PER_AD = 10;

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

export default function DiscoveryQueue({ fan }: { fan: Fan }) {
  const [track, setTrack] = useState<Track | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [breakout, setBreakout] = useState<string | null>(null);
  /** The track just kept, named while the next one loads. */
  /** A badge just earned, shown on its own timer rather than inside the gap. */
  const [unlocked, setUnlocked] = useState<string | null>(null);
  /** Set when a swipe did not reach the server, so the card can be tried again. */
  const [swipeFailed, setSwipeFailed] = useState(false);
  /** Set when the next track could not be loaded, so the spinner is not forever. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [justSaved, setJustSaved] = useState<{
    title: string;
    artistName: string;
    /** Filled in once the server says where they landed. */
    note?: string | null;
    /** A badge that this save just earned, announced once. */
    unlocked?: string | null;
  } | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  // Asked after the first save, never before, and never twice.
  const [askEmail, setAskEmail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clip, setClip] = useState({ currentTime: 0, duration: 30 });
  const sharedRef = useRef<string | null | undefined>(undefined);
  // Chosen mood, remembered between visits — someone who filtered to Jazz
  // last night probably still wants Jazz, but can switch in one tap.
  const [genre, setGenre] = useState<string | null>(null);
  // On unless the listener has turned it off. Defaulting to exclusion would
  // bury the artists who answered the question honestly.
  const [allowAi, setAllowAi] = useState(true);
  const [genreCounts, setGenreCounts] = useState<Record<string, number>>();
  const [exhausted, setExhausted] = useState<{ othersAvailable: number } | null>(null);
  const [showAd, setShowAd] = useState(false);
  const swipesSinceAd = useRef(0);

  useEffect(() => {
    setGenre(localStorage.getItem(GENRE_KEY));
    setAllowAi(localStorage.getItem(AI_KEY) !== "0");
  }, []);

  function chooseAi(next: boolean) {
    setAllowAi(next);
    localStorage.setItem(AI_KEY, next ? "1" : "0");
    // The card on screen was chosen under the old setting, so it goes.
    setTrack(undefined);
    setExhausted(null);
    setRefreshKey((k) => k + 1);
  }

  function chooseGenre(next: string | null) {
    setGenre(next);
    if (next) localStorage.setItem(GENRE_KEY, next);
    else localStorage.removeItem(GENRE_KEY);
    setTrack(undefined);
    setExhausted(null);
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let ignore = false;
    setClip({ currentTime: 0, duration: 30 });
    // Read once, on the first fetch of the session.
    if (sharedRef.current === undefined) sharedRef.current = takeSharedTrack();
    const startWith = sharedRef.current;
    sharedRef.current = null;

    setLoadFailed(false);
    fetchNextTrack(genre, allowAi, startWith)
      .then((res) => {
        if (ignore) return;
        setTrack(res.track);
        setExhausted(
          res.genreExhausted ? { othersAvailable: res.othersAvailable ?? 0 } : null
        );
      })
      // Without this a dropped connection left the rejection unhandled and,
      // worse, setTrack was never called: track stayed undefined and the
      // spinner ran for ever. The feed looked like it was still loading when
      // nothing was coming.
      .catch(() => {
        if (!ignore) setLoadFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [fan.id, refreshKey, genre, allowAi]);

  // Refreshed alongside the feed so the per-genre counts stay honest as the
  // fan swipes through them.
  useEffect(() => {
    fetch(`/api/discover/genres`)
      .then((r) => r.json())
      .then((d) => setGenreCounts(d.counts))
      .catch(() => {});
  }, [fan.id, refreshKey]);

  // Held long enough to read, and independent of whether the next track has
  // arrived. Tying it to the loading gap meant it was a race against the feed,
  // and the feed won every time.
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => setUnlocked(null), 3600);
    return () => clearTimeout(t);
  }, [unlocked]);

  useEffect(() => {
    if (!breakout) return;
    const t = setTimeout(() => setBreakout(null), 4000);
    return () => clearTimeout(t);
  }, [breakout]);

  async function handleSwipe(direction: "LEFT" | "RIGHT", listenMs: number) {
    if (!track) return;
    setSwipeFailed(false);
    // Set before the request, not after it. The gap this fills is the request
    // itself, and a reveal that waits for the server to answer would arrive
    // after the thing it was meant to fill.
    setJustSaved(direction === "RIGHT" ? { title: track.title, artistName: track.artistName } : null);
    setPending(true);

    /**
     * A swipe that does not reach the server must not advance the feed.
     *
     * fetch rejects outright when the connection drops mid-request, which on
     * a phone is ordinary. The throw used to escape this function, so
     * setPending(false) never ran and the card stayed on screen disabled for
     * ever: the feed looked frozen and reloading was the only way out. A
     * server error was quieter and worse — the feed moved on and the verdict
     * was lost without anyone knowing.
     *
     * Either way the track was not recorded, so the card stays and they can
     * swipe it again.
     */
    let data: { track?: { fanRightSwipes?: number; createdAt?: string }; feeNowRequested?: boolean } | null = null;
    try {
      const res = await fetch("/api/discover/swipe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId: track.id, direction, listenMs }),
      });
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch {
      setJustSaved(null);
      setPending(false);
      setSwipeFailed(true);
      return;
    }

    if (direction === "RIGHT") {
      bumpSavedCount();
      // Arrives a beat after the name, during the fetch for the next
      // track, so it reads as the result of the save settling rather
      // than as something the feed was waiting on.
      const note = saveMoment({
        position: data?.track?.fanRightSwipes ?? 0,
        listenMs,
        createdAt: data?.track?.createdAt ?? null,
        savedTotal: savedTotal(),
      });
      setJustSaved((prev) => (prev ? { ...prev, note } : prev));

      // Deliberately not awaited. It runs alongside the fetch for the next
      // track, so the notice lands inside a gap that already exists rather
      // than adding one, and a failure here never holds up a swipe.
      void fetch(`/api/fans/achievements`)
        .then((r) => (r.ok ? r.json() : null))
        .then((a) => {
          if (!a?.badges) return;
          const earned = a.badges.filter((b: { earned: boolean }) => b.earned);
          const fresh = newlyEarned(earned.map((b: { id: string }) => b.id));
          if (!fresh.length) return;
          const name = earned.find((b: { id: string }) => b.id === fresh[0])?.name;
          if (name) setUnlocked(name);
        })
        .catch(() => {});
      setSavedCount((c) => {
        const next = c + 1;
        // The moment they have something worth keeping. Not on arrival,
        // when they have heard nothing and owe us no address.
        if (next === 1 && !fan.hasEmail && !savePromptDismissed()) setAskEmail(true);
        return next;
      });
    }
    if (data?.feeNowRequested) setBreakout(track.title);

    swipesSinceAd.current += 1;
    const adDue =
      Boolean(ADSENSE_CLIENT && ADSENSE_SLOT) && swipesSinceAd.current >= SWIPES_PER_AD;

    setTrack(undefined);
    setRefreshKey((k) => k + 1);
    if (adDue) {
      swipesSinceAd.current = 0;
      setShowAd(true);
    }
    setPending(false);
  }

  return (
    <MotrShell fill clip={track && !showAd ? clip : null}>
      <div className="w-full max-w-sm shrink-0 md:max-w-2xl">
        <GenrePicker value={genre} onChange={chooseGenre} counts={genreCounts} />
      </div>

      {/* Sits on the row that already carries the listener's own settings,
          rather than adding a row of its own — the swipe screen has to fit a
          phone without scrolling. Off means "hide tracks the artist declared
          as AI"; it can only ever be as good as their answer, which is the
          same limitation Spotify's own AI credits have. */}

      <div className="mb-3 flex w-full max-w-sm shrink-0 items-center justify-between md:max-w-2xl">
        <span className="motr-label">
          <span className="text-ink">{fan.username}</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => chooseAi(!allowAi)}
            aria-pressed={allowAi}
            title={
              allowAi
                ? "AI music is included. Tap to hide tracks the artist declared as AI."
                : "AI music is hidden. Tap to include it again."
            }
            className={`motr-label flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
              allowAi
                ? "border-edge text-muted hover:text-ink"
                : "border-gold/50 bg-gold/10 text-gold"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${allowAi ? "bg-muted" : "bg-gold"}`}
            />
            AI {allowAi ? "on" : "off"}
          </button>

          <span className="motr-label flex items-center gap-1.5">
            <Note className="text-gold h-3 w-3" />
            <span className="text-gold">{savedCount}</span> saved
          </span>
        </div>
      </div>

      {/* A track clearing the fan vote is the whole point of the app —
          give it a moment rather than a quiet toast. */}
      {/* Says the verdict did not save, because the card staying put looks
          identical to the card being stuck. Not a toast: it has to still be
          there when they look down, not three seconds later. */}
      {swipeFailed && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-4">
          <div className="border-nope/50 bg-surface flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl">
            <p className="text-sm">
              <span className="motr-label text-nope block">Not saved</span>
              <span className="text-muted">That didn&apos;t reach us. Swipe it again.</span>
            </p>
          </div>
        </div>
      )}

      {/* The whole screen edge, for the moment it happens. */}
      {unlocked && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-30"
          style={{
            // Deep enough to be seen rather than noticed afterwards. The
            // first version was a 3px ring with a 60px glow, which on a phone
            // is a hairline: it read as a rendering artefact, not an event.
            animation: "motr-unlock-edge 3400ms ease-out forwards",
            boxShadow: [
              "inset 0 0 0 7px var(--color-gold)",
              "inset 0 0 44px 2px var(--color-gold)",
              "inset 0 0 190px -28px var(--color-gold)",
            ].join(", "),
          }}
        />
      )}

      {/* Over the feed, not inside it, so it survives the next card arriving. */}
      {unlocked && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-4">
          <div className="border-gold bg-surface flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl">
            <span className="bg-gold/15 text-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <Seal className="h-5 w-5" />
            </span>
            <p className="text-sm">
              <span className="motr-label text-gold block">Badge unlocked</span>
              <span className="font-semibold">{unlocked}</span>
            </p>
          </div>
        </div>
      )}

      {breakout && (
        <div className="fixed inset-x-0 top-0 z-30 flex justify-center px-5 pt-4">
          <div className="border-gold/40 bg-surface flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl">
            <Disc className="text-gold h-6 w-6 shrink-0" />
            <p className="text-sm">
              <span className="text-gold font-semibold">{breakout}</span> broke through.
              Enough of you backed it.
            </p>
          </div>
        </div>
      )}

      {/* A way out of a failed load. The spinner alone said "still coming"
          when nothing was, and the only escape was reloading the app. */}
      {loadFailed && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-semibold">That didn&apos;t load</p>
          <p className="text-muted max-w-xs text-sm">
            Check your connection and try again. Nothing you have saved is lost.
          </p>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="border-gold text-gold hover:bg-gold/10 rounded-full border px-6 py-2.5 text-sm font-semibold uppercase tracking-wider transition"
          >
            Try again
          </button>
        </div>
      )}

      {!loadFailed && track === undefined && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Equalizer className="text-gold/30 h-10 w-10 " />
          {/* Uses time that was already being spent. Fetching the next track
              leaves a gap no matter what, and a name read in that gap costs
              nothing, where a screen that paused the feed to show the same
              name would cost a swipe every time. */}
          {justSaved && (
            <div className="space-y-1.5">
              <p className="text-sm">
                <span className="text-muted">You kept </span>
                <span className="font-semibold">{justSaved.title}</span>
                <span className="text-muted"> by </span>
                <span className="text-gold font-semibold">{justSaved.artistName}</span>
              </p>
              {justSaved.note && <p className="text-muted text-xs">{justSaved.note}</p>}
            </div>
          )}
        </div>
      )}

      {track === null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Disc className="text-gold/40 h-12 w-12" />
          <p className="font-display text-2xl uppercase tracking-wide">
            {exhausted ? `That's all the ${genre?.split(" / ")[0]}` : "You're all caught up"}
          </p>
          <p className="text-muted max-w-xs text-sm">
            {exhausted && exhausted.othersAvailable > 0
              ? `You've heard every ${genre?.split(" / ")[0]} track we have. There are ${exhausted.othersAvailable} more waiting in other genres.`
              : "You've heard everything in the queue. New tracks land here constantly, so check back soon."}
          </p>
          {exhausted && exhausted.othersAvailable > 0 && (
            <button
              onClick={() => chooseGenre(null)}
              className="bg-gold text-bg mt-1 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wide"
            >
              Play everything
            </button>
          )}
          {savedCount > 0 && (
            <a
              href="/saved"
              className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
            >
              See your {savedCount} saved
            </a>
          )}
        </div>
      )}

      {/* The ad takes the card's place rather than sitting beside it, so the
          screen still holds exactly one thing and nothing has to scroll. The
          next track carries on loading underneath. */}
      {showAd && ADSENSE_CLIENT && ADSENSE_SLOT && (
        <SponsoredCard
          client={ADSENSE_CLIENT}
          slot={ADSENSE_SLOT}
          onDismiss={() => setShowAd(false)}
        />
      )}

      {!showAd && track && (
        <SwipeCard
          key={track.id}
          track={track}
          disabled={pending}
          onSwipe={(direction, listenMs) => handleSwipe(direction, listenMs)}
          onProgress={(currentTime, duration) => setClip({ currentTime, duration })}
        />
      )}

      {askEmail && (
        <SaveEmailPrompt
          fanId={fan.id}
          savedCount={savedCount}
          onClose={() => setAskEmail(false)}
        />
      )}
    </MotrShell>
  );
}
