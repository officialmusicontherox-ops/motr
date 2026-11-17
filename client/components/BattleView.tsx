"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import MotrShell from "./MotrShell";
import SponsoredCard from "./SponsoredCard";
import { AppleMusicMark, SpotifyMark } from "./ServiceMarks";
import { Pause, Play, Share } from "./icons";
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
  spotifyUrl: string;
  appleUrl: string | null;
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
  const [copied, setCopied] = useState(false);
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
      setCopied(false);
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

  async function copyLink() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(`${APP}/battles?b=${reveal.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard refused. Nothing else to offer, and nothing broken.
    }
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
            swipe={false}
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
                    // Copies the link and nothing else. Saving or sharing the
                    // picture sent an iPhone into the Files app with no way
                    // back. The link still shows the battle's picture when
                    // it is pasted into a post or a message.
                    onClick={() => void copyLink()}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-full border py-3 text-sm font-bold transition ${
                      copied ? "border-gold bg-gold/10 text-gold" : "border-gold/60 text-gold hover:bg-gold/10"
                    }`}
                  >
                    <Share className="h-4 w-4" />
                    {copied ? "Link copied" : "Copy link"}
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
            // Sized by the space it is given, and measured as a container,
            // so the layout inside follows the panel's real shape rather
            // than the screen's: see .battle-box in globals.css.
            className="battle-box relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300"
            style={{
              borderColor: lit ? `rgba(${tube.glow}, 0.55)` : "#1e1e22",
              boxShadow: lit ? `inset 0 0 22px rgba(${tube.glow}, ${playing ? 0.24 : 0.1})` : "none",
            }}
          >
            <div className={`battle-stage flex h-full w-full flex-col ${side === "A" ? "from-right" : ""}`}>
            {revealed ? (
              <>
                {/* The whole cover, square, the way the artist made it, and
                    nothing laid over it. In a tall panel it sits on top with
                    the result under it; in a wide one, beside it. */}
                <div className="relative aspect-square w-full shrink-0 bg-black battle-cover">
                  {revealed.artworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={revealed.artworkUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>

                {/* Three groups down the space under the cover: who it is at
                    the top, the score in the middle, the record at the
                    bottom. On a phone that space is tall, and one group
                    centred in it floated in an empty box. */}
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 px-3 py-2.5 text-white battle-text">
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
                  className="relative aspect-square w-full shrink-0 bg-black battle-cover"
                >
                  {open?.artworkUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={open.artworkUrl} alt="" className="h-full w-full object-cover" />
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
                <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2 text-white battle-text">
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
      </div>

      {decided ? (
        // Both services under every song, so each listener opens the one
        // they use. Logos only on a phone, where the panel is narrow.
        <div className="mt-2.5 flex gap-2">
          {revealed && (
            <a
              href={revealed.spotifyUrl}
              target="_blank"
              rel="noopener"
              aria-label={`Open ${revealed.title} in Spotify`}
              className="border-edge text-muted hover:text-ink flex flex-1 items-center justify-center gap-2 rounded-full border py-2.5 text-sm transition"
            >
              <SpotifyMark className="h-4 w-4 text-[#1DB954]" />
              <span className="hidden md:inline">Spotify</span>
            </a>
          )}
          {revealed?.appleUrl && (
            <a
              href={revealed.appleUrl}
              target="_blank"
              rel="noopener"
              aria-label={`Open ${revealed.title} in Apple Music`}
              className="border-edge text-muted hover:text-ink flex flex-1 items-center justify-center gap-2 rounded-full border py-2.5 text-sm transition"
            >
              <AppleMusicMark className="h-4 w-4 text-[#FA2D48]" />
              <span className="hidden md:inline">Apple Music</span>
            </a>
          )}
        </div>
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
