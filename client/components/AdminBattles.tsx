"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Data = {
  weekLabel: string;
  counts: { decided: number; skipped: number; open: number; voters: number };
  totals: { key: string; name: string; wins: number; battles: number }[];
  thisWeek: { key: string; name: string; wins: number }[];
  recent: { id: string; at: string; genre: string; a: string; b: string; winner: "A" | "B" | null }[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The complete battle record.
 *
 * The public board shows rank and name for a week or a month. This is
 * everything behind it, kept for good: an artist's wins never reset, so
 * nobody is worse off for having joined Battles in its first week.
 */
export default function AdminBattles() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/battles")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <AdminSection title="Battles" description="Couldn't load.">
        <p className="text-muted text-sm">Try again in a moment.</p>
      </AdminSection>
    );
  }
  if (!data) {
    return (
      <AdminSection title="Battles" description="Loading...">
        <p className="text-muted text-sm">Loading...</p>
      </AdminSection>
    );
  }

  return (
    <>
      <AdminSection title="Battles" description="Every vote cast, and what it added up to">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="battles decided" value={data.counts.decided} />
          <Tile label="listeners who voted" value={data.counts.voters} />
          <Tile label="skipped" value={data.counts.skipped} sub="counted for nobody" />
          <Tile label="open right now" value={data.counts.open} sub="served, not answered" />
        </div>
      </AdminSection>

      <AdminSection title="This week" description={data.weekLabel}>
        {data.thisWeek.length === 0 ? (
          <p className="text-muted text-sm">No battles decided yet this week.</p>
        ) : (
          <Table
            head={["#", "Artist", "Wins this week"]}
            rows={data.thisWeek.map((r, i) => [String(i + 1), r.name, String(r.wins)])}
          />
        )}
      </AdminSection>

      <AdminSection
        title="All-time record"
        description="Complete totals. These never reset."
      >
        {data.totals.length === 0 ? (
          <p className="text-muted text-sm">Nobody has battled yet.</p>
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

      <AdminSection title="Latest battles" description="Newest first" defaultOpen={false}>
        {data.recent.length === 0 ? (
          <p className="text-muted text-sm">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted motr-label">
                <tr>
                  <th className="pb-2 pr-3">When</th>
                  <th className="pb-2 pr-3">Genre</th>
                  <th className="pb-2 pr-3">A</th>
                  <th className="pb-2 pr-3">B</th>
                  <th className="pb-2">Picked</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((b) => (
                  <tr key={b.id} className="border-edge border-t">
                    <td className="text-muted py-2 pr-3 whitespace-nowrap">{when(b.at)}</td>
                    <td className="text-muted py-2 pr-3">{b.genre.split(" /")[0]}</td>
                    <td className={`py-2 pr-3 ${b.winner === "A" ? "text-gold font-semibold" : ""}`}>
                      {b.a}
                    </td>
                    <td className={`py-2 pr-3 ${b.winner === "B" ? "text-gold font-semibold" : ""}`}>
                      {b.b}
                    </td>
                    <td className="text-muted py-2">{b.winner ?? "skipped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <td
                  key={j}
                  className={`py-2 pr-3 ${j === 1 ? "font-semibold" : "text-muted tabular-nums"}`}
                >
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
