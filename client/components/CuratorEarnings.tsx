"use client";

import { useCallback, useEffect, useState } from "react";
import MotrShell from "./MotrShell";
import { Crown } from "./icons";
import type { User } from "@/lib/types";

type Balance = {
  heldCents: number;
  availableCents: number;
  withdrawnCents: number;
  minWithdrawalCents: number;
  withdrawalFeeCents: number;
  netIfWithdrawnCents: number;
  canWithdraw: boolean;
};

type Payout = {
  id: string;
  amountCents: number;
  status: string;
  maturesAt: string;
  track: { title: string; artistName: string };
};

type Withdrawal = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number | null;
  status: string;
  requestedAt: string;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CuratorEarnings({ curator }: { curator: User }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/curator/earnings?userId=${curator.id}`);
    if (!res.ok) return;
    const d = await res.json();
    setBalance(d.balance);
    setPayouts(d.payouts);
    setWithdrawals(d.withdrawals);
  }, [curator.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function cashOut() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/curator/earnings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: curator.id, payoutDestination: destination || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not request a cashout");
      return;
    }
    load();
  }

  const toGo = balance ? balance.minWithdrawalCents - balance.availableCents : 0;
  const progress = balance
    ? Math.min(100, (balance.availableCents / balance.minWithdrawalCents) * 100)
    : 0;

  return (
    <MotrShell>
      <div className="w-full max-w-lg md:max-w-3xl">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl uppercase tracking-wide">Earnings</h1>
          <a
            href="/curate"
            className="border-edge text-muted hover:text-white shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition"
          >
            Queue
          </a>
        </div>

        {!balance ? (
          <div className="mt-12 flex justify-center">
            <Crown className="text-gold/30 h-8 w-8 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Available" value={money(balance.availableCents)} gold />
              <Stat label="Clearing" value={money(balance.heldCents)} />
              <Stat label="Cashed out" value={money(balance.withdrawnCents)} />
            </div>

            <div className="border-edge bg-surface mt-5 rounded-2xl border p-5">
              {/* Progress toward the cashout minimum — more motivating than a number alone. */}
              <div className="flex items-baseline justify-between">
                <span className="motr-label">To cash out</span>
                <span className="text-muted text-xs tabular-nums">
                  {money(balance.availableCents)} / {money(balance.minWithdrawalCents)}
                </span>
              </div>
              <div className="bg-surface-2 mt-2 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-gold h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="PayPal email for payment"
                className="border-edge bg-bg focus:border-gold mt-4 w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-600"
              />
              <button
                onClick={cashOut}
                disabled={!balance.canWithdraw || busy}
                className="bg-gold text-bg mt-3 w-full rounded-full px-5 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:opacity-30"
              >
                {busy
                  ? "Requesting..."
                  : balance.canWithdraw
                    ? `Cash out ${money(balance.netIfWithdrawnCents)}`
                    : `${money(toGo)} to go`}
              </button>
              <p className="text-muted mt-2 text-center text-xs">
                Earnings clear 7 days after a share is verified. A{" "}
                {money(balance.withdrawalFeeCents)} processing fee comes out of each cashout
                {balance.canWithdraw
                  ? ` — ${money(balance.availableCents)} balance, ${money(balance.netIfWithdrawnCents)} to you.`
                  : "."}
              </p>
              <p className="text-muted mt-1 text-center text-xs">
                Paid in USD through PayPal, wherever you are. If your account holds another
                currency, PayPal converts it at their rate.
              </p>
              {error && <p className="text-nope mt-3 text-sm">{error}</p>}
            </div>

            <section className="mt-8">
              <h2 className="motr-label">Your shares</h2>
              {payouts.length === 0 ? (
                <p className="text-muted mt-3 text-sm">
                  Nothing yet — share a track from your queue to start earning.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {payouts.map((p) => (
                    <li
                      key={p.id}
                      className="border-edge bg-surface flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {p.track.title}{" "}
                        <span className="text-muted">— {p.track.artistName}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="text-gold font-semibold">{money(p.amountCents)}</span>
                        <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
                          {p.status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {withdrawals.length > 0 && (
              <section className="mt-8">
                <h2 className="motr-label">Cashouts</h2>
                <ul className="mt-3 space-y-2">
                  {withdrawals.map((w) => (
                    <li
                      key={w.id}
                      className="border-edge bg-surface flex items-center justify-between rounded-xl border p-3 text-sm"
                    >
                      <span className="text-muted">
                        {new Date(w.requestedAt).toLocaleDateString()}
                      </span>
                      <span className="text-right">
                        <span className="font-semibold">
                          {money(w.netCents ?? w.amountCents)}
                        </span>
                        <span className="text-muted block text-[0.6rem] uppercase tracking-widest">
                          {w.status}
                          {w.feeCents > 0 && ` · ${money(w.feeCents)} fee`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </MotrShell>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="border-edge bg-surface rounded-xl border p-4">
      <p className="motr-label text-[0.6rem]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${gold ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}
