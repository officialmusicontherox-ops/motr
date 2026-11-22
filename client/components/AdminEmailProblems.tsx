"use client";

import { useEffect, useState } from "react";
import AdminSection, { Pager, usePager } from "./AdminSection";

type Problem = {
  email: string;
  kind: string;
  reason: string | null;
  subject: string | null;
  last: string;
  times: number;
  who: "artist" | "listener" | "other";
  artistName: string | null;
  liveSongs: number;
  optedOut: boolean;
};

const KIND: Record<string, string> = {
  refused: "Refused when sent",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Failed",
  suppressed: "Blocked by Resend (earlier bounce or spam report)",
};

/**
 * Addresses MOTR's email is not reaching. Artists first, because an artist
 * here is missing their battle links, results and chart emails, and the
 * Terms let a track come out of the feed until they give an address that
 * works.
 */
export default function AdminEmailProblems() {
  const [rows, setRows] = useState<Problem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const page = usePager(15);

  useEffect(() => {
    fetch("/api/admin/email-problems")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setRows(
          [...d.problems].sort(
            (a: Problem, b: Problem) =>
              Number(b.who === "artist") - Number(a.who === "artist") ||
              b.last.localeCompare(a.last)
          )
        )
      )
      .catch(() => setFailed(true));
  }, []);

  const artists = rows?.filter((r) => r.who === "artist").length ?? 0;
  const last = rows ? Math.max(0, Math.ceil(rows.length / page.pageSize) - 1) : 0;
  const shown = Math.min(page.page, last);

  return (
    <AdminSection
      title="Emails that did not arrive"
      description={
        rows
          ? rows.length === 0
            ? "Nothing has failed to arrive"
            : `${rows.length} address${rows.length === 1 ? "" : "es"}, ${artists} of them artist${artists === 1 ? "" : "s"}`
          : "Addresses MOTR's email is not reaching"
      }
    >
      {failed ? (
        <p className="text-muted text-sm">Couldn&apos;t load.</p>
      ) : !rows ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">
          Nothing yet. Sends Resend refuses are recorded from now on, and bounces once Resend&apos;s
          webhook is connected.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.slice(shown * page.pageSize, shown * page.pageSize + page.pageSize).map((r) => (
              <li key={r.email} className="border-edge bg-surface rounded-xl border p-3">
                <p className="text-sm font-semibold">
                  {r.artistName ?? (r.who === "listener" ? "Listener" : "Not on MOTR")}
                  {r.who === "artist" && (
                    <span className="text-muted font-normal">
                      {" "}
                      · {r.liveSongs} song{r.liveSongs === 1 ? "" : "s"} live
                      {r.optedOut ? " · unsubscribed" : ""}
                    </span>
                  )}
                </p>
                <p className="text-muted break-all text-xs">{r.email}</p>
                <p className="mt-1 text-xs">
                  <span className="text-nope font-semibold">{KIND[r.kind] ?? r.kind}</span>
                  <span className="text-muted">
                    {" "}
                    · {new Date(r.last).toLocaleDateString()}
                    {r.times > 1 ? ` · ${r.times} times` : ""}
                  </span>
                </p>
                {(r.reason || r.subject) && (
                  <p className="text-muted mt-0.5 text-xs">
                    {r.subject ? `"${r.subject}"` : ""}
                    {r.subject && r.reason ? ": " : ""}
                    {r.reason ?? ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pager page={shown} pageSize={page.pageSize} total={rows.length} onPage={page.setPage} />
        </>
      )}
    </AdminSection>
  );
}
