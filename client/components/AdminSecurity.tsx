"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSection, { ShowMore, useVisibleCount } from "./AdminSection";

type Attempt = {
  id: string;
  ip: string;
  email: string;
  success: boolean;
  userAgent: string | null;
  createdAt: string;
};

type Stats = { failed24h: number; success24h: number; lockedOut: string[] };

/**
 * Who's been trying to get in.
 *
 * Blocking an attack isn't much use if you never learn it happened — a burst
 * of failures from one address is what tells you someone is actually
 * targeting the site, rather than you mistyping a code.
 */
export default function AdminSecurity() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const page = useVisibleCount(10);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security");
    if (!res.ok) return;
    const d = await res.json();
    setAttempts(d.recent);
    setStats(d.stats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const failed = stats?.failed24h ?? 0;

  return (
    <AdminSection
      title="Security"
      description="Sign-in attempts on this dashboard. Five failures from one address locks it for 15 minutes."
      defaultOpen={false}
      badge={
        failed > 0 ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
            {failed} failed today
          </span>
        ) : undefined
      }
    >
      {stats && (
        <>
          {stats.lockedOut.length > 0 ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {stats.lockedOut.length} address(es) locked out right now:{" "}
              <span className="font-mono text-xs">{stats.lockedOut.join(", ")}</span>. They
              can&apos;t try again for 15 minutes. If this isn&apos;t you, someone is guessing —
              your password and authenticator code both still stand in their way.
            </p>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
              Nothing locked out. {stats.success24h} successful and {failed} failed sign-in(s) in
              the last 24 hours.
            </p>
          )}
        </>
      )}

      {attempts === null ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No sign-in attempts recorded yet.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Email tried</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, page.visible).map((a) => (
                  <tr key={a.id} className="border-t border-edge">
                    <td className="whitespace-nowrap p-3 text-muted">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {a.success ? (
                        <span className="text-emerald-300">Signed in</span>
                      ) : (
                        <span className="text-nope">Failed</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted">{a.ip}</td>
                    <td className="max-w-[16rem] truncate p-3 text-muted">{a.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ShowMore
            shown={page.visible}
            total={attempts.length}
            onMore={page.more}
            onLess={page.reset}
          />
        </>
      )}
    </AdminSection>
  );
}
