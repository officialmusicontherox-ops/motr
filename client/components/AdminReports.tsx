"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection from "./AdminSection";

type Point = {
  bucket: string;
  newFans: number;
  activeFans: number;
  swipes: number;
  rightSwipes: number;
  approvalRate: number | null;
  avgListenMs: number | null;
  tracksAdded: number;
  submissions: number;
  payments: number;
  revenueCents: number;
  verifiedShares: number;
};

type Report = {
  period: string;
  label: string;
  series: Point[];
  totals: Omit<Point, "bucket">;
  generatedAt: string;
};

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
] as const;

/**
 * Metrics the chart can plot. One at a time and one series each — the job is
 * "how did this move", which is magnitude over time, so a single hue is the
 * right encoding and no legend is needed.
 */
const METRICS = [
  { key: "swipes", label: "Swipes", format: (n: number) => n.toLocaleString() },
  { key: "newFans", label: "Arrived", format: (n: number) => n.toLocaleString() },
  { key: "activeFans", label: "Swiped at least once", format: (n: number) => n.toLocaleString() },
  {
    key: "approvalRate",
    label: "Approval rate",
    format: (n: number) => `${Math.round(n * 100)}%`,
  },
  {
    key: "avgListenMs",
    label: "Avg listen",
    format: (n: number) => `${(n / 1000).toFixed(1)}s`,
  },
  { key: "submissions", label: "Artist submissions", format: (n: number) => n.toLocaleString() },
  {
    key: "revenueCents",
    label: "Revenue",
    format: (n: number) => `$${(n / 100).toFixed(2)}`,
  },
  { key: "verifiedShares", label: "Verified shares", format: (n: number) => n.toLocaleString() },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function bucketLabel(iso: string, period: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (period === "yearly") return String(d.getUTCFullYear());
  if (period === "monthly")
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function AdminReports() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("daily");
  const [metric, setMetric] = useState<MetricKey>("swipes");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const chosen = METRICS.find((m) => m.key === metric)!;
  const values = report?.series.map((p) => (p[metric] as number | null) ?? 0) ?? [];
  const max = Math.max(...values, 0);
  const peakIndex = values.indexOf(max);

  return (
    <AdminSection
      title="Reports"
      description="How everything is moving, by day, week, month or year."
      defaultOpen={false}
    >
      {/* Controls sit in one row above the chart and are hidden when printing. */}
      <div className="no-print flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              period === p.key
                ? "bg-gold text-bg"
                : "border border-edge text-muted transition hover:border-gold/50 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-full border border-edge px-4 py-1.5 text-sm font-semibold transition hover:border-gold hover:text-gold"
          >
            Save as PDF
          </button>
        </span>
      </div>

      {loading && !report ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : !report ? (
        <p className="mt-4 text-sm text-muted">Couldn&apos;t load the report.</p>
      ) : (
        <div id="motr-report" className="mt-4">
          {/* Only shows on paper, so the printout says what it is. */}
          <div className="print-only mb-4">
            <h2 className="text-xl font-semibold">MOTR — {report.label}</h2>
            <p className="text-sm text-muted">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>

          <p className="text-xs uppercase tracking-widest text-muted">{report.label}</p>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Swipes" value={report.totals.swipes.toLocaleString()} gold />
            <Tile label="Arrived" value={report.totals.newFans.toLocaleString()} />
            <Tile
              label="Swiped at least once"
              value={report.totals.activeFans.toLocaleString()}
              gold
            />
            <Tile
              label="Approval rate"
              value={
                report.totals.approvalRate === null
                  ? "—"
                  : `${Math.round(report.totals.approvalRate * 100)}%`
              }
            />
            <Tile
              label="Avg listen"
              value={
                report.totals.avgListenMs === null
                  ? "—"
                  : `${(report.totals.avgListenMs / 1000).toFixed(1)}s`
              }
            />
            <Tile label="Tracks added" value={report.totals.tracksAdded.toLocaleString()} />
            <Tile label="Submissions" value={report.totals.submissions.toLocaleString()} />
            <Tile label="Verified shares" value={report.totals.verifiedShares.toLocaleString()} />
            <Tile label="Revenue" value={money(report.totals.revenueCents)} gold />
          </div>

          {/* One metric, one series, one hue — the chart's title says what it
              plots, so a legend would only restate it. */}
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold">{chosen.label} over time</h3>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricKey)}
                aria-label="Choose metric to plot"
                className="no-print rounded-full border border-edge bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
              >
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <Chart
              series={report.series}
              values={values}
              max={max}
              peakIndex={peakIndex}
              period={report.period}
              format={chosen.format}
            />
          </div>

          {/* The table is the accessible view of the same numbers, and it is
              what makes the printed PDF useful rather than decorative. */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="p-2.5">Period</th>
                  <th className="p-2.5">Arrived</th>
                  <th className="p-2.5">Swiped</th>
                  <th className="p-2.5">Swipes</th>
                  <th className="p-2.5">Approval</th>
                  <th className="p-2.5">Avg listen</th>
                  <th className="p-2.5">Subs</th>
                  <th className="p-2.5">Shares</th>
                  <th className="p-2.5">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.series.map((p) => (
                  <tr key={p.bucket} className="border-t border-edge">
                    <td className="whitespace-nowrap p-2.5">
                      {bucketLabel(p.bucket, report.period)}
                    </td>
                    <td className="p-2.5 tabular-nums">{p.newFans}</td>
                    <td className="p-2.5 tabular-nums">{p.activeFans}</td>
                    <td className="p-2.5 tabular-nums">{p.swipes}</td>
                    <td className="p-2.5 tabular-nums">
                      {p.approvalRate === null ? "—" : `${Math.round(p.approvalRate * 100)}%`}
                    </td>
                    <td className="p-2.5 tabular-nums">
                      {p.avgListenMs === null ? "—" : `${(p.avgListenMs / 1000).toFixed(1)}s`}
                    </td>
                    <td className="p-2.5 tabular-nums">{p.submissions}</td>
                    <td className="p-2.5 tabular-nums">{p.verifiedShares}</td>
                    <td className="p-2.5 tabular-nums">
                      {p.revenueCents ? money(p.revenueCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted">
            &ldquo;Save as PDF&rdquo; opens your browser&apos;s print dialog — choose
            <strong className="text-white"> Save as PDF</strong> as the destination. Only this
            report is included.
          </p>
        </div>
      )}
    </AdminSection>
  );
}

/**
 * Column chart, single series.
 *
 * SVG rather than a charting library: one series of at most 30 columns needs
 * no dependency, and the bundle stays small.
 */
function Chart({
  series,
  values,
  max,
  peakIndex,
  period,
  format,
}: {
  series: Point[];
  values: number[];
  max: number;
  peakIndex: number;
  period: string;
  format: (n: number) => string;
}) {
  if (max <= 0) {
    return (
      <p className="mt-3 rounded-xl border border-edge bg-surface p-6 text-center text-sm text-muted">
        Nothing recorded in this period yet.
      </p>
    );
  }

  const W = 720;
  const H = 200;
  const padBottom = 26;
  const slot = W / values.length;
  // Capped so a short series doesn't render as slabs; the leftover is air.
  const barW = Math.min(24, slot - 2);

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-edge bg-surface p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[200px] w-full min-w-[520px]"
        role="img"
        aria-label={`Chart of values over time. Peak ${format(max)}.`}
      >
        {/* Recessive baseline — hairline, solid, one step off the surface. */}
        <line
          x1="0"
          y1={H - padBottom}
          x2={W}
          y2={H - padBottom}
          stroke="#2a2a2a"
          strokeWidth="1"
        />

        {values.map((v, i) => {
          const h = max > 0 ? (v / max) * (H - padBottom - 22) : 0;
          const x = i * slot + (slot - barW) / 2;
          const y = H - padBottom - h;
          return (
            <g key={series[i].bucket}>
              {v > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="4"
                  fill="#dcb55f"
                  opacity={i === peakIndex ? 1 : 0.75}
                >
                  <title>
                    {bucketLabel(series[i].bucket, period)}: {format(v)}
                  </title>
                </rect>
              )}
              {/* Label the peak only — a number on every column goes unread. */}
              {i === peakIndex && v > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#c9c9c9"
                >
                  {format(v)}
                </text>
              )}
            </g>
          );
        })}

        {/* First, middle and last ticks — enough to orient without clutter. */}
        {[0, Math.floor(values.length / 2), values.length - 1].map((i) => (
          <text
            key={i}
            x={i * slot + slot / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#8b8b8b"
          >
            {bucketLabel(series[i].bucket, period)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Tile({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${gold ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}
