"use client";

import { useState } from "react";

/**
 * One panel of the admin dashboard.
 *
 * The page was a single unbroken column, so Tracks ran straight into Records
 * with nothing marking where one ended. Each section is now a card with its
 * own heading, and collapsing is available because the dashboard is read
 * top-to-bottom far more often than it's acted on — being able to fold away
 * the parts you're not using is what makes it scannable.
 */
export default function AdminSection({
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  /** Short status shown next to the title, e.g. a pending count. */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-edge bg-surface/40">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-surface-2/40"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{title}</span>
            {badge}
          </span>
          {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
        </span>

        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && <div className="border-t border-edge px-5 py-5">{children}</div>}
    </section>
  );
}

/**
 * "Show more" for long lists. Loading 200 rows into the page and expecting
 * someone to scroll is the problem this exists to avoid.
 */
export function useVisibleCount(step = 10) {
  const [visible, setVisible] = useState(step);
  return {
    visible,
    more: () => setVisible((v) => v + step),
    reset: () => setVisible(step),
    step,
  };
}

export function ShowMore({
  shown,
  total,
  onMore,
  onLess,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  onLess: () => void;
}) {
  if (total <= shown && shown <= 10) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <span className="text-muted">
        Showing {Math.min(shown, total)} of {total}
      </span>
      {shown < total && (
        <button
          onClick={onMore}
          className="rounded-full border border-edge px-4 py-1.5 font-semibold transition hover:border-gold hover:text-gold"
        >
          Show more
        </button>
      )}
      {shown > 10 && (
        <button onClick={onLess} className="text-muted underline underline-offset-2 hover:text-ink">
          Collapse
        </button>
      )}
    </div>
  );
}

/**
 * Page-at-a-time navigation, for lists whose rows are tall.
 *
 * "Show more" suits a list of short rows: you glance down it and press the
 * button if you want another ten. It suits a failed submission badly, because
 * each one carries a URL, a reason and three controls, so ten of them is a
 * long scroll on a phone and the button is somewhere past the end of it.
 */
export function usePager(pageSize: number) {
  const [page, setPage] = useState(0);
  return {
    page,
    pageSize,
    setPage,
    reset: () => setPage(0),
    slice<T>(items: T[]): T[] {
      return items.slice(page * pageSize, page * pageSize + pageSize);
    },
  };
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const first = page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, total);

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className="border-edge hover:border-gold hover:text-gold rounded-full border px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        Back
      </button>

      <span className="text-muted text-center text-xs">
        {first}&ndash;{last} of {total}
        <span className="block">
          Page {page + 1} of {pages}
        </span>
      </span>

      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pages - 1}
        className="border-edge hover:border-gold hover:text-gold rounded-full border px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        Next
      </button>
    </div>
  );
}
