"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import MotrShell from "./MotrShell";
import SponsoredCard from "./SponsoredCard";
import { Cross, Pause, Play, Share } from "./icons";
import { clipPlayer, playClip } from "@/lib/clipPlayer";
import { bumpSavedCount } from "@/lib/savedCount";
import { safeLocal } from "@/lib/storage";

type OpenSide = { previewUrl: string; title: string; artworkUrl: string | null };

type Open = {
  ticket: string;
  genre: string;
  a: OpenSide;
  b: OpenSide;
};

type Side = {
  title: string;
  artistName: string;
  artworkUrl: string | null;
  listenUrl: string;
  listenOn: "spotify" | "apple";
  wins: number;
};

type Reveal = {
  id: string;
  pick: "A" | "B" | null;
  a: Side;
  b: Side;
  pct: { a: number; b: number } | null;
  closed: boolean;
  winner: "A" | "B" | null;
  week: string;
  closes: string;
  genre: string;
};

type Letter = "A" | "B";

/** Each side keeps one colour, before and after the reveal. */
const TUBE: Record<Letter, { edge: string; glow: string }> = {
  A: { edge: "#b45cff", glow: "180, 92, 255" },
  B: { edge: "#38c6f4", glow: "56, 198, 244" },
};

const APP = "https://app.musicontherox.com";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

/** An ad after every this many battles answered. */
const BATTLES_PER_AD = 5;

/**
 * Battles: two blind songs from one genre, and you pick one.
 *
 * Everyone gets the same battles, each one runs for the chart week, and the
 * song ahead when the week closes takes the win.
 *
 * No swiping here on purpose. A swipe is a reflex, and this is a choice
 * between two things, so it is made with a button after both have been
 * heard. The play buttons belong to the listener: either song, as many
 * times as they like, in any order.
 *
 * Blind in the same way Discover is: the cover, the title and the genre are
 * shown, and the artist is not. The browser is not sent the artist's name
 * before the vote, nor an id it could look one up with. A skip moves on
 * without a reveal, because the reveal is what a vote earns.
 */
export default function BattleView() {
  /** undefined while loading, null when there is nothing left to vote on. */
  const [battle, setBattle] = useState<Open | null | undefined>(undefined);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [playing, setPlaying] = useState<Letter | null>(null);
  const [heard, setHeard] = useState<Record<Letter, boolean>>({ A: false, B: false });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Whether this battle was reached by somebody's shared link. */
  const viaShare = useRef(false);
  /** Battles answered, vote or skip, since the last ad. */
  const sinceAd = useRef(0);
  const [showAd, setShowAd] = useState(false);

  const stop = useCallback(() => {
    clipPlayer()?.pause();
    setPlaying(null);
    setProgress(0);
  }, []);

  const load = useCallback(
    async (asked?: string | null) => {
      stop();
      setReveal(null);
      setHeard({ A: false, B: false });
      setFailed(false);
      setBattle(undefined);
      try {
        const q = new URLSearchParams();
        // The same switch the swipe feed honours.
        try {
          if (safeLocal.getItem("motr_allow_ai") === "0") q.set("ai", "0");
        } catch {
          // Storage refused. Everything is included, which is the default.
        }
        if (asked) q.set("b", asked);
        const res = await fetch(`/api/battles/next?${q}`);
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        viaShare.current = !!d.viaShare;
        setReveal(d.reveal ?? null);
        setBattle(d.battle ?? null);
      } catch {
        setFailed(true);
        setBattle(null);
      }
    },
    [stop]
  );

  // A shared link names its battle. It is served first, and the marker is
  // taken out of the address bar so "Next battle" and a refresh carry on
  // through the rest instead of returning here.
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("b");
    if (asked) window.history.replaceState({}, "", window.location.pathname);
    void load(asked);
  }, [load]);

  // One shared audio element, the same one the swipe card uses, so the
  // unlock a listener earned by tapping play anywhere still holds here.
  useEffect(() => {
    const a = clipPlayer();
    if (!a) return;
    const onEnd = () => {
      setPlaying(null);
      setProgress(0);
    };
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.addEventListener("ended", onEnd);
    a.addEventListener("timeupdate", onTime);
    return () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("timeupdate", onTime);
      // A clip must not outlive the tab it was started on.
      a.pause();
    };
  }, []);

  function toggle(side: Letter) {
    if (!battle) return;
    const a = clipPlayer();
    if (!a) return;
    if (playing === side) {
      a.pause();
      setPlaying(null);
      return;
    }
    setPlaying(side);
    setProgress(0);
    setHeard((h) => ({ ...h, [side]: true }));
    // Started inside the tap, with nothing awaited first, or iOS refuses it.
    void playClip(side === "A" ? battle.a.previewUrl : battle.b.previewUrl).then((ok) => {
      if (!ok) setPlaying((p) => (p === side ? null : p));
    });
  }

  async function answer(pick: Letter | "SKIP") {
    if (!battle || busy) return;
    setBusy(true);
    stop();
    try {
      const res = await fetch("/api/battles/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket: battle.ticket, pick, viaShare: viaShare.current }),
      });
      // 409 is a battle already answered or closed since it was served.
      // Either way the right move is the next one.
      if (res.status === 409 || pick === "SKIP") {
        if (pick === "SKIP") sinceAd.current += 1;
        next();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      // The song they picked goes into Saved, so the tab's count moves the
      // way it does for a right swipe.
      bumpSavedCount();
      sinceAd.current += 1;
      setBattle(null);
      setReveal(d.reveal);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  /**
   * On to the next battle, with an ad first after every fifth one answered.
   *
   * Counted in battles answered, votes and skips alike, the way Discover
   * counts swipes. The ad takes the screen while the next battle loads
   * underneath, so it is ready the moment the ad is passed.
   */
  function next() {
    if (ADSENSE_CLIENT && ADSENSE_SLOT && sinceAd.current >= BATTLES_PER_AD) {
      sinceAd.current = 0;
      setShowAd(true);
    }
    void load();
  }

  const ready = heard.A && heard.B;
  const other = (s: Letter): Letter => (s === "A" ? "B" : "A");

  return (
    <MotrShell fill logo={false}>
      <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {showAd && ADSENSE_CLIENT && ADSENSE_SLOT && (
          <SponsoredCard
            client={ADSENSE_CLIENT}
            slot={ADSENSE_SLOT}
            nextLabel="Next battle"
            onDismiss={() => setShowAd(false)}
          />
        )}

        {/* Hidden rather than unmounted while an ad is up, so the battle
            loading underneath keeps its state. */}
        <div className={showAd ? "hidden" : "contents"}>
        {/* The brush lettering itself, made to match the MOTR logo, with its
            black ground turned into transparency so it sits on either theme. */}
        <Image
          src="/battles-title.png"
          alt="Battles"
          width={1000}
          height={296}
          priority
          className="mx-auto h-16 w-auto shrink-0 md:h-16"
        />
        <p className="text-muted mx-auto mt-1.5 max-w-md shrink-0 text-center text-xs md:text-sm">
          {reveal
            ? reveal.closed
              ? `Final result · ${reveal.week}`
              : `Your pick is in Saved. Voting closes ${reveal.closes} at midnight Central.`
            : "Two songs, head to head. The artists are shown after you vote."}
        </p>

        {battle === undefined && !reveal && (
          <p className="text-muted mt-10 text-center text-sm">Finding a battle...</p>
        )}

        {battle === null && !reveal && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="font-display text-xl uppercase tracking-wide">
              {failed ? "Couldn't load a battle" : "You've voted in them all"}
            </p>
            <p className="text-muted max-w-xs text-sm">
              {failed
                ? "Give it a moment and try again."
                : "That's every battle this week. New ones open Sunday, and the winners are settled Saturday at midnight Central."}
            </p>
            {failed ? (
              <button
                onClick={() => void load()}
                className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
              >
                Try again
              </button>
            ) : (
              <Link
                href="/charts"
                className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
              >
                See who&apos;s ahead
              </Link>
            )}
          </div>
        )}

        {(battle || reveal) && (
          <>
            {/* The same pill the Discover card carries. */}
            <p className="mt-2 flex shrink-0 justify-center">
              <span className="border-gold/40 text-gold rounded-full border px-3 py-0.5 text-[0.68rem] font-semibold uppercase tracking-widest">
                {(battle?.genre ?? reveal?.genre ?? "").split(" /")[0]}
              </span>
            </p>

            <div className="relative mt-2 grid min-h-0 flex-1 grid-cols-2 gap-3 md:gap-6">
              {(["A", "B"] as const).map((side) => (
                <Panel
                  key={side}
                  side={side}
                  open={battle ? (side === "A" ? battle.a : battle.b) : null}
                  revealed={reveal ? (side === "A" ? reveal.a : reveal.b) : null}
                  pct={reveal?.pct ? (side === "A" ? reveal.pct.a : reveal.pct.b) : null}
                  // Lit means "the one that matters here": your pick while
                  // voting is open, the winner once it has closed.
                  lit={
                    !reveal ||
                    (reveal.closed ? reveal.winner !== other(side) : reveal.pick !== other(side))
                  }
                  badge={
                    reveal?.closed && reveal.winner === side
                      ? "Winner"
                      : reveal?.pick === side
                        ? "Your pick"
                        : null
                  }
                  decided={!!reveal}
                  playing={playing === side}
                  progress={playing === side ? progress : 0}
                  canChoose={ready && !busy}
                  onPlay={() => toggle(side)}
                  onChoose={() => void answer(side)}
                />
              ))}

              {/* Between the two, over the gap, the way a fight card has it. */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2"
              >
                <Image
                  src="/battles-vs.png"
                  alt=""
                  width={480}
                  height={296}
                  priority
                  className="h-14 w-auto drop-shadow-[0_0_12px_rgba(0,0,0,0.95)] md:h-20"
                />
              </div>
            </div>

            <div className="mt-3 flex shrink-0 flex-col items-center gap-1 pb-1">
              {reveal ? (
                <div className="flex w-full max-w-md gap-2">
                  <button
                    onClick={() => setSharing(true)}
                    className="border-gold/60 text-gold hover:bg-gold/10 flex flex-1 items-center justify-center gap-2 rounded-full border py-3 text-sm font-bold transition"
                  >
                    <Share className="h-4 w-4" />
                    Share
                  </button>
                  <button
                    onClick={next}
                    className="bg-gold text-bg flex-[1.4] rounded-full py-3 text-sm font-bold"
                  >
                    Next battle
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-muted h-4 text-xs">
                    {ready ? "" : "Play both to vote or skip."}
                  </p>
                  {/* Counts for nobody and shows nothing. A forced pick
                      between two songs somebody dislikes is a coin toss,
                      and a coin toss is worse data than no vote.

                      Locked until both have been played, like the vote.
                      Open from the start, skips ran three to one over
                      votes: it was a next button, and battles were being
                      passed over unheard. */}
                  <button
                    onClick={() => void answer("SKIP")}
                    disabled={busy || !ready}
                    className="text-muted hover:text-ink text-xs underline underline-offset-4 transition disabled:no-underline disabled:opacity-40"
                  >
                    Skip this one
                  </button>
                </>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {sharing && reveal && <ShareSheet reveal={reveal} onClose={() => setSharing(false)} />}
    </MotrShell>
  );
}

function Panel({
  side,
  open,
  revealed,
  pct,
  lit,
  badge,
  decided,
  playing,
  progress,
  canChoose,
  onPlay,
  onChoose,
}: {
  side: Letter;
  open: OpenSide | null;
  revealed: Side | null;
  pct: number | null;
  lit: boolean;
  badge: string | null;
  decided: boolean;
  playing: boolean;
  progress: number;
  canChoose: boolean;
  onPlay: () => void;
  onChoose: () => void;
}) {
  const tube = TUBE[side];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Three rings of tube, one inside the next. Borders on nested boxes
          rather than shadows, because the artwork that arrives on the
          reveal would paint straight over an inset shadow. */}
      <div
        className="flex min-h-0 flex-1 flex-col rounded-[26px] border-2 p-[3px] transition-all duration-300"
        style={{
          // A stage, so it is dark in both themes and the tube reads as lit.
          background: "#0c0c10",
          borderColor: lit ? tube.edge : "#2a2a30",
          boxShadow: lit ? `0 0 18px rgba(${tube.glow}, ${playing ? 0.8 : 0.42})` : "none",
          opacity: lit ? 1 : 0.6,
        }}
      >
        <div
          className="flex min-h-0 flex-1 flex-col rounded-[21px] border-2 p-[3px] transition-colors duration-300"
          style={{ borderColor: lit ? `rgba(${tube.glow}, 0.75)` : "#232328" }}
        >
          <div
            // On a laptop each cover sits on the inner side, next to the VS,
            // so the VS overlaps artwork and never a title.
            className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
              side === "A" ? "md:flex-row-reverse" : "md:flex-row"
            }`}
            style={{
              borderColor: lit ? `rgba(${tube.glow}, 0.55)` : "#1e1e22",
              boxShadow: lit ? `inset 0 0 22px rgba(${tube.glow}, ${playing ? 0.24 : 0.1})` : "none",
            }}
          >
            {revealed ? (
              <>
                {/* The whole cover, square, the way the artist made it, and
                    nothing laid over it. On a laptop the panel is short and
                    wide, so the cover sits on the left at the panel's full
                    height and the result goes beside it. Stacked, there was
                    not the height for both. */}
                <div className="relative aspect-square w-full shrink-0 bg-black md:aspect-square md:h-full md:w-auto md:max-w-[55%] md:flex-none">
                  {revealed.artworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={revealed.artworkUrl} alt="" className="h-full w-full object-cover md:object-contain" />
                  )}
                </div>

                {/* Three groups down the space under the cover: who it is at
                    the top, the score in the middle, the record at the
                    bottom. On a phone that space is tall, and one group
                    centred in it floated in an empty box. */}
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 px-3 py-2.5 text-white md:min-w-0 md:justify-center md:gap-2 md:px-4">
                  <div className="min-w-0">
                    {badge && (
                      <span className="bg-gold text-bg mb-1.5 inline-block rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-widest">
                        {badge}
                      </span>
                    )}
                    <p className="truncate text-sm font-semibold leading-snug">{revealed.title}</p>
                    <p className="truncate text-xs leading-snug text-neutral-400">{revealed.artistName}</p>
                  </div>

                  {/* A share of the vote and never a count of it. Only a
                      battle nobody has voted in has no score. */}
                  {pct !== null ? (
                    <p
                      className="font-display text-3xl leading-none md:text-3xl"
                      style={{ color: tube.edge, textShadow: `0 0 12px rgba(${tube.glow}, 0.7)` }}
                    >
                      {pct}%
                    </p>
                  ) : (
                    <p className="text-[0.68rem] uppercase tracking-widest text-neutral-500">
                      Voting is open
                    </p>
                  )}

                  <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-neutral-400">
                    Battle Wins · {revealed.wins}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* The cover is the play button, with the control drawn on
                    it. Tap it as often as you like. */}
                <button
                  type="button"
                  onClick={onPlay}
                  aria-label={
                    playing ? `Pause ${open?.title ?? "song"}` : `Play ${open?.title ?? "song"}`
                  }
                  className="relative aspect-square w-full shrink-0 bg-black md:aspect-square md:h-full md:w-auto md:max-w-[55%] md:flex-none"
                >
                  {open?.artworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={open.artworkUrl} alt="" className="h-full w-full object-cover md:object-contain" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 bg-black/60 text-white md:h-16 md:w-16"
                      style={{ borderColor: tube.edge, boxShadow: `0 0 14px rgba(${tube.glow}, 0.6)` }}
                    >
                      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                    <span
                      className="block h-full"
                      style={{ width: `${Math.round(progress * 100)}%`, background: tube.edge }}
                    />
                  </span>
                </button>
                <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2 text-white md:min-w-0 md:px-4">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{open?.title}</p>
                  {/* Said out loud, as on Discover, because a missing name
                      otherwise reads as something broken. */}
                  <p className="mt-1 text-[0.68rem] text-neutral-500">Artist shown after you vote</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {decided ? (
        <a
          href={revealed?.listenUrl}
          target="_blank"
          rel="noopener"
          className="border-edge text-muted hover:text-ink mt-2.5 rounded-full border py-2.5 text-center text-sm transition"
        >
          {revealed?.listenOn === "apple" ? "Open in Apple Music" : "Open in Spotify"}
        </a>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          disabled={!canChoose}
          aria-label={open ? `Vote for ${open.title}` : "Vote"}
          className="mt-2.5 rounded-full border-2 py-2.5 text-sm font-bold uppercase tracking-widest transition disabled:opacity-35"
          style={{
            borderColor: tube.edge,
            color: tube.edge,
            boxShadow: canChoose ? `0 0 14px rgba(${tube.glow}, 0.45)` : "none",
          }}
        >
          Vote
        </button>
      )}
    </div>
  );
}

/**
 * Share a battle: the image for a story or a post, and the link.
 *
 * The phone's own share sheet is used where it will take an image, which
 * is how the card reaches an Instagram story in one step. Everywhere else
 * the image can be saved and the link copied, so nobody is left with a
 * button that does nothing on their device.
 */
function ShareSheet({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);

  const url = `${APP}/battles?b=${reveal.id}`;
  const card = (format: "story" | "post") => `/api/battles/card?b=${reveal.id}&format=${format}`;
  const text = reveal.closed
    ? `${reveal.a.artistName} vs ${reveal.b.artistName} on MOTR Battles. Here is how it finished.`
    : `${reveal.a.artistName} vs ${reveal.b.artistName} on MOTR Battles. Two songs, head to head. Come vote.`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard refused. The link is printed below, so it can be selected.
    }
  }

  async function native() {
    setWorking(true);
    try {
      // With the image where the device takes one, which is what lets it
      // go straight into a story. With the link alone where it does not.
      try {
        const blob = await fetch(card("story")).then((r) => (r.ok ? r.blob() : Promise.reject()));
        const file = new File([blob], "motr-battle.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: `${text} ${url}` });
          return;
        }
      } catch {
        // Fall through to sharing the link by itself.
      }
      await navigator.share({ title: "MOTR Battles", text, url });
    } catch {
      // Cancelling the share sheet lands here too, and is not a failure.
    } finally {
      setWorking(false);
    }
  }

  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share this battle"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="border-edge bg-surface pb-safe w-full max-w-sm rounded-t-3xl border p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-xl uppercase tracking-wide">Share this battle</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border-edge text-muted hover:text-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition"
          >
            <Cross className="h-3 w-3" />
          </button>
        </div>

        {/* The post version, because it is the one that fits a sheet. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card("post")}
          alt={`${reveal.a.artistName} versus ${reveal.b.artistName}`}
          className="border-edge mt-4 aspect-square w-full rounded-2xl border bg-black object-cover"
        />

        <div className="mt-4 space-y-2">
          {canNative && (
            <button
              onClick={() => void native()}
              disabled={working}
              className="bg-gold text-bg flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-50"
            >
              <Share className="h-4 w-4" />
              {working ? "Getting it ready..." : "Share"}
            </button>
          )}
          <button
            onClick={() => void copy()}
            className={`w-full rounded-full border py-3 text-sm font-semibold transition ${
              copied ? "border-gold text-gold" : "border-edge hover:border-gold"
            }`}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <div className="flex gap-2">
            <a
              href={card("story")}
              download="motr-battle-story.png"
              className="border-edge hover:border-gold flex-1 rounded-full border py-2.5 text-center text-sm transition"
            >
              Save for a story
            </a>
            <a
              href={card("post")}
              download="motr-battle-post.png"
              className="border-edge hover:border-gold flex-1 rounded-full border py-2.5 text-center text-sm transition"
            >
              Save for a post
            </a>
          </div>
        </div>

        <p className="text-muted mt-3 break-all text-center text-xs">{url}</p>
      </div>
    </div>
  );
}
