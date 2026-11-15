"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { NEON, NeonText } from "./Neon";
import { Pause, Play } from "./icons";
import { clipPlayer, playClip } from "@/lib/clipPlayer";

type Open = {
  id: string;
  genre: string;
  a: { previewUrl: string };
  b: { previewUrl: string };
};

type Side = {
  title: string;
  artistName: string;
  artworkUrl: string | null;
  spotifyUrl: string;
  wins: number;
};

type Reveal = { winner: "A" | "B"; a: Side; b: Side };
type Letter = "A" | "B";

/** Each side keeps one colour from the logo, before and after the reveal. */
const TUBE: Record<Letter, { edge: string; glow: string; pair: string[] }> = {
  A: { edge: "#b45cff", glow: "180, 92, 255", pair: [NEON.pink, "#b45cff"] },
  B: { edge: "#38c6f4", glow: "56, 198, 244", pair: [NEON.blue, "#5ee6e6"] },
};

/**
 * Battles: two blind songs from one genre, and you pick one.
 *
 * No swiping here on purpose. A swipe is a reflex, and this is a choice
 * between two things, so it is made with a button after both have been
 * heard. The play buttons belong to the listener: either song, as many
 * times as they like, in any order.
 *
 * Nothing on screen names anybody until the vote is in. The browser is not
 * even sent the names before then, so there is nothing to peek at. A skip
 * moves on without a reveal, because the reveal is what a vote earns.
 */
export default function BattleView() {
  /** undefined while loading, null when there is nothing left to pair. */
  const [battle, setBattle] = useState<Open | null | undefined>(undefined);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [playing, setPlaying] = useState<Letter | null>(null);
  const [heard, setHeard] = useState<Record<Letter, boolean>>({ A: false, B: false });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    clipPlayer()?.pause();
    setPlaying(null);
    setProgress(0);
  }, []);

  const load = useCallback(async () => {
    stop();
    setReveal(null);
    setHeard({ A: false, B: false });
    setFailed(false);
    setBattle(undefined);
    try {
      // The same switch the swipe feed honours.
      let ai = "";
      try {
        if (localStorage.getItem("motr_allow_ai") === "0") ai = "?ai=0";
      } catch {
        // Storage refused. Everything is included, which is the default.
      }
      const res = await fetch(`/api/battles/next${ai}`);
      if (!res.ok) throw new Error(String(res.status));
      setBattle((await res.json()).battle ?? null);
    } catch {
      setFailed(true);
      setBattle(null);
    }
  }, [stop]);

  useEffect(() => {
    void load();
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
        body: JSON.stringify({ battleId: battle.id, pick }),
      });
      // 409 is a battle already answered, from a second tab or a double
      // tap. Either way the right move is the next one.
      if (res.status === 409 || pick === "SKIP") {
        await load();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setReveal((await res.json()).reveal);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const ready = heard.A && heard.B;

  return (
    <MotrShell fill>
      <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {/* The brush lettering itself, made to match the MOTR logo, with its
            black ground turned into transparency so it sits on either theme. */}
        <Image
          src="/battles-title.png"
          alt="Battles"
          width={1000}
          height={296}
          priority
          className="mx-auto h-12 w-auto shrink-0 md:h-16"
        />
        <p className="text-muted mx-auto mt-1.5 max-w-md shrink-0 text-center text-xs md:text-sm">
          {reveal
            ? "There they are."
            : "Two songs, no names. Pick the one you would play again."}
        </p>

        {battle === undefined && (
          <p className="text-muted mt-10 text-center text-sm">Finding a battle...</p>
        )}

        {battle === null && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="font-display text-xl uppercase tracking-wide">
              {failed ? "Couldn't load a battle" : "You've judged them all"}
            </p>
            <p className="text-muted max-w-xs text-sm">
              {failed
                ? "Give it a moment and try again."
                : "Every pairing we can make for you has been decided. New battles appear as artists submit music."}
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
                href="/"
                className="border-gold/50 text-gold mt-2 rounded-full border px-5 py-2 text-sm font-semibold"
              >
                Back to Discover
              </Link>
            )}
          </div>
        )}

        {battle && (
          <>
            <p className="motr-label text-muted mt-2 shrink-0 text-center">
              {battle.genre.split(" /")[0]}
            </p>

            <div className="relative mt-2 grid min-h-0 flex-1 grid-cols-2 gap-3 md:gap-6">
              {(["A", "B"] as const).map((side) => (
                <Panel
                  key={side}
                  side={side}
                  revealed={reveal ? (side === "A" ? reveal.a : reveal.b) : null}
                  won={reveal?.winner === side}
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
                <button
                  onClick={() => void load()}
                  className="bg-gold text-bg w-full max-w-xs rounded-full py-3 text-sm font-bold"
                >
                  Next battle
                </button>
              ) : (
                <>
                  <p className="text-muted h-4 text-xs">
                    {ready ? "" : "Play both to unlock your vote."}
                  </p>
                  {/* Counts for nobody and shows nothing. A forced pick
                      between two songs somebody dislikes is a coin toss,
                      and a coin toss is worse data than no vote. */}
                  <button
                    onClick={() => void answer("SKIP")}
                    disabled={busy}
                    className="text-muted hover:text-ink text-xs underline underline-offset-4 transition disabled:opacity-40"
                  >
                    Skip this one
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </MotrShell>
  );
}

function Panel({
  side,
  revealed,
  won,
  decided,
  playing,
  progress,
  canChoose,
  onPlay,
  onChoose,
}: {
  side: Letter;
  revealed: Side | null;
  won: boolean;
  decided: boolean;
  playing: boolean;
  progress: number;
  canChoose: boolean;
  onPlay: () => void;
  onChoose: () => void;
}) {
  const tube = TUBE[side];
  // After the vote the loser's tube goes out, which says who won without a
  // word of copy.
  const lit = !decided || won;

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
          boxShadow: lit
            ? `0 0 18px rgba(${tube.glow}, ${playing ? 0.8 : 0.42})`
            : "none",
          opacity: lit ? 1 : 0.6,
        }}
      >
      <div
        className="flex min-h-0 flex-1 flex-col rounded-[21px] border-2 p-[3px] transition-colors duration-300"
        style={{ borderColor: lit ? `rgba(${tube.glow}, 0.75)` : "#232328" }}
      >
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300"
        style={{
          borderColor: lit ? `rgba(${tube.glow}, 0.55)` : "#1e1e22",
          boxShadow: lit ? `inset 0 0 22px rgba(${tube.glow}, ${playing ? 0.24 : 0.1})` : "none",
        }}
      >
        {revealed ? (
          <>
            {/* The whole cover, square, the way the artist made it. Filling
                the tall panel edge to edge cropped the lettering off both
                sides of the artwork. */}
            <div className="aspect-square w-full shrink-0 bg-black">
              {revealed.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={revealed.artworkUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2.5 text-white">
              {won && (
                <span className="bg-gold text-bg mb-1 inline-block rounded-full px-2 py-px text-[0.58rem] font-bold uppercase tracking-widest">
                  Your pick
                </span>
              )}
              <p className="truncate text-sm font-semibold">{revealed.title}</p>
              <p className="truncate text-xs text-neutral-400">{revealed.artistName}</p>
              <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-widest" style={{ color: tube.edge }}>
                Battle Wins · {revealed.wins}
              </p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label={playing ? `Pause song ${side}` : `Play song ${side}`}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3"
          >
            <NeonText
              text={side}
              width={56}
              height={84}
              fontSize={76}
              colors={tube.pair}
              className="h-16 md:h-24"
            />
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-white transition md:h-16 md:w-16"
              style={{ borderColor: tube.edge, boxShadow: `0 0 12px rgba(${tube.glow}, 0.5)` }}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </span>
            <span className="h-1 w-2/3 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%`, background: tube.edge }}
              />
            </span>
          </button>
        )}
      </div>
      </div>
      </div>

      {decided ? (
        <a
          href={revealed?.spotifyUrl}
          target="_blank"
          rel="noopener"
          className="border-edge text-muted hover:text-ink mt-2.5 rounded-full border py-2.5 text-center text-sm transition"
        >
          Open in Spotify
        </a>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          disabled={!canChoose}
          className="mt-2.5 rounded-full border-2 py-2.5 text-sm font-bold uppercase tracking-widest transition disabled:opacity-35"
          style={{
            borderColor: tube.edge,
            color: tube.edge,
            boxShadow: canChoose ? `0 0 14px rgba(${tube.glow}, 0.45)` : "none",
          }}
        >
          Choose {side}
        </button>
      )}
    </div>
  );
}
