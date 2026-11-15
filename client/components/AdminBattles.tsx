"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Data = {
  weekLabel: string;
  counts: { votes: number; skips: number; shared: number; voters: number; open: number; closed: number; cancelled: number };
  thisWeek: { id: string; genre: string; a: string; b: string; votesA: number; votesB: number; shared: number }[];
  leaders: { key: string; name: string; wins: number }[];
  totals: { key: string; name: string; wins: number; battles: number }[];
};

/**
 * The complete battle record.
 *
 * Listeners see percentages and artists see ranks. This is everything
 * behind them, with the real counts: this week's battles and their links,
 * how many votes arrived by a shared link, and every artist's all-time
 * record, which is kept for good and never resets.
 */
export default function AdminBattles() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/battles")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed || !data) {
    return (
      <AdminSection title="Battles" description={failed ? "Couldn't load." : "Loading..."}>
        <p className="text-muted text-sm">{failed ? "Try again in a moment." : "Loading..."}</p>
      </AdminSection>
    );
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(`https://app.musicontherox.com/battles?b=${id}`);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard refused. Nothing to do but leave the button as it was.
    }
  }

  return (
    <>
      <AdminSection title="Battles" description="Every vote cast, and what it added up to">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="votes cast" value={data.counts.votes} sub={`${data.counts.voters} listeners`} />
          <Tile label="came by shared link" value={data.counts.shared} sub="of those votes" />
          <Tile label="skipped" value={data.counts.skips} sub="counted for nobody" />
          <Tile label="battles this week" value={data.counts.open} sub={data.weekLabel} />
          <Tile label="battles finished" value={data.counts.closed} sub="in weeks gone by" />
          <Tile label="called off" value={data.counts.cancelled} sub="a song was pulled" />
        </div>
      </AdminSection>

      <AdminSection title="This week's battles" description={`${data.weekLabel} · closes Saturday at midnight Central`}>
        {data.thisWeek.length === 0 ? (
          <p className="text-muted text-sm">No battles paired yet this week.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted motr-label">
                <tr>
                  <th className="pb-2 pr-3">Genre</th>
                  <th className="pb-2 pr-3">A</th>
                  <th className="pb-2 pr-3">B</th>
                  <th className="pb-2 pr-3">Votes</th>
                  <th className="pb-2 pr-3">Split</th>
                  <th className="pb-2 pr-3">By link</th>
                  <th className="pb-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {data.thisWeek.map((b) => {
                  const total = b.votesA + b.votesB;
                  const pa = total ? Math.round((b.votesA / total) * 100) : 0;
                  return (
                    <tr key={b.id} className="border-edge border-t">
                      <td className="text-muted py-2 pr-3">{b.genre.split(" /")[0]}</td>
                      <td className={`py-2 pr-3 ${b.votesA > b.votesB ? "text-gold font-semibold" : ""}`}>{b.a}</td>
                      <td className={`py-2 pr-3 ${b.votesB > b.votesA ? "text-gold font-semibold" : ""}`}>{b.b}</td>
                      <td className="text-muted py-2 pr-3 tabular-nums whitespace-nowrap">
                        {b.votesA} to {b.votesB}
                      </td>
                      <td className="text-muted py-2 pr-3 tabular-nums whitespace-nowrap">
                        {total ? `${pa}% / ${100 - pa}%` : "-"}
                      </td>
                      <td className="text-muted py-2 pr-3 tabular-nums">{b.shared}</td>
                      <td className="py-2">
                        <button
                          onClick={() => void copy(b.id)}
                          className="border-edge hover:border-gold rounded-full border px-3 py-1 text-xs transition"
                        >
                          {copied === b.id ? "Copied" : "Copy"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Leading this week" description="Who is ahead in their battle right now">
        {data.leaders.length === 0 ? (
          <p className="text-muted text-sm">Nobody is ahead yet.</p>
        ) : (
          <Table head={["#", "Artist"]} rows={data.leaders.map((r, i) => [String(i + 1), r.name])} />
        )}
      </AdminSection>

      <AdminSection title="All-time record" description="Complete totals from finished weeks. These never reset.">
        {data.totals.length === 0 ? (
          <p className="text-muted text-sm">No week has finished yet. Totals are written when one does.</p>
        ) : (
          <Table
            head={["#", "Artist", "Wins", "Battles", "Win rate"]}
            rows={data.totals.map((r, i) => [
              String(i + 1),
              r.name,
              String(r.wins),
              String(r.battles),
              r.battles ? `${Math.round((r.wins / r.battles) * 100)}%` : "-",
            ])}
          />
        )}
      </AdminSection>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-3">
      <p className="motr-label text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-muted mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted motr-label">
          <tr>
            {head.map((h) => (
              <th key={h} className="pb-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-edge border-t">
              {r.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${j === 1 ? "font-semibold" : "text-muted tabular-nums"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
