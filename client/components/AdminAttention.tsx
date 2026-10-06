"use client";

import { useEffect, useState } from "react";

type Item = {
  key: string;
  tab: string;
  label: string;
  count: number;
  tone: "warn" | "bad" | "info";
};

/**
 * What needs you, before you open anything.
 *
 * Every panel knows its own count, but only after it has loaded, and a
 * collapsed panel never loads. So a dashboard with three failed submissions
 * and an unresolved error looked exactly like one with nothing to do, and the
 * only way to find out was to open all fourteen.
 *
 * Tapping a chip goes to the tab that fixes it.
 */
export default function AdminAttention({ onGo }: { onGo: (tab: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/attention", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const body = await res.json();
        if (alive) setItems(body.items ?? []);
      } catch {
        // A strip that cannot load is not worth an error message; the panels
        // underneath still work.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!items) return null;

  if (items.length === 0) {
    return (
      <div className="border-edge bg-surface mt-6 flex items-center gap-2 rounded-xl border px-4 py-3">
        <span className="bg-hot h-2 w-2 shrink-0 rounded-full" />
        <p className="text-muted text-sm">Nothing needs you right now.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={i.key}
          onClick={() => onGo(i.tab)}
          className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
            i.tone === "bad"
              ? "border-nope/40 bg-nope/10 text-nope hover:border-nope"
              : i.tone === "warn"
                ? "border-gold/40 bg-gold/10 text-gold hover:border-gold"
                : "border-edge text-muted hover:border-gold hover:text-gold"
          }`}
        >
          {i.count} {i.label}
          {i.count === 1 ? "" : "s"}
        </button>
      ))}
    </div>
  );
}
