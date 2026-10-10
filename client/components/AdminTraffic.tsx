"use client";

import { useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Row = { views: number; viewers: number };
type Data = {
  totals: { views: number; viewers: number; fromShare: number };
  windows: { day: Row; week: Row; month: Row };
  funnel: { landed: number; started: number; rate: number | null };
  paths: { path: string; views: number }[];
  referrers: { host: string | null; views: number }[];
  countries: { country: string | null; views: number }[];
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-3">
      <div className="text-gold text-2xl font-bold leading-none">{value}</div>
      <div className="text-muted mt-1 text-xs">{label}</div>
      {sub && <div className="text-muted/70 mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

function Bars({ rows, empty }: { rows: { label: string; views: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted mt-2 text-xs">{empty}</p>;
  const top = Math.max(...rows.map((r) => r.views), 1);
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="text-muted shrink-0 tabular-nums">{r.views.toLocaleString()}</span>
          </div>
          <div className="bg-surface-2 mt-1 h-1.5 overflow-hidden rounded-full">
            <div className="bg-gold h-full rounded-full" style={{ width: `${(r.views / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminTraffic() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/traffic")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load traffic"))))
      .then((j) => live && setD(j))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, []);

  return (
    <AdminSection
      title="Traffic"
      description="Everyone who loaded a page, including the ones who never pressed anything. Counting started when this was switched on, so it is not backdated."
    >
      {err && <p className="text-nope mt-2 text-sm">{err}</p>}
      {!d && !err && <p className="text-muted mt-2 text-sm">Loading...</p>}

      {d && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="people, all time" value={d.totals.viewers.toLocaleString()} sub={`${d.totals.views.toLocaleString()} page views`} />
            <Tile label="people today" value={d.windows.day.viewers.toLocaleString()} sub={`${d.windows.day.views.toLocaleString()} views`} />
            <Tile label="people, last 7 days" value={d.windows.week.viewers.toLocaleString()} sub={`${d.windows.week.views.toLocaleString()} views`} />
            <Tile label="people, last 30 days" value={d.windows.month.viewers.toLocaleString()} sub={`${d.windows.month.views.toLocaleString()} views`} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tile
              label="landed, then started listening"
              value={d.funnel.rate === null ? "--" : `${d.funnel.rate}%`}
              sub={`${d.funnel.started} of ${d.funnel.landed} who opened the front page`}
            />
            <Tile
              label="came from an artist's share link"
              value={d.totals.fromShare.toLocaleString()}
              sub="views carrying a track link"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Pages</p>
              <Bars rows={d.paths.map((p) => ({ label: p.path, views: p.views }))} empty="Nothing yet." />
            </div>
            <div>
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Came from</p>
              <Bars
                rows={d.referrers.map((r) => ({ label: r.host ?? "unknown", views: r.views }))}
                empty="Nobody has arrived from another site yet. Direct visits and app links show nothing here."
              />
            </div>
            <div>
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Countries</p>
              <Bars rows={d.countries.map((c) => ({ label: c.country ?? "unknown", views: c.views }))} empty="Nothing yet." />
            </div>
          </div>
        </>
      )}
    </AdminSection>
  );
}
