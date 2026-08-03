import Image from "next/image";
import Link from "next/link";

/**
 * Top bar for the standalone pages reached from the menu. Those pages sit
 * outside the tab-bar shell, so without this there's no way out of them.
 *
 * Always goes home rather than using history.back(): landing here directly
 * from a bookmark or shared link leaves nothing to go back to, and "back"
 * silently doing nothing is worse than a predictable destination.
 */
export default function PageNav() {
  return (
    <div className="border-edge bg-bg/95 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur">
      <Link
        href="/"
        className="border-edge bg-surface text-gold hover:border-gold flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-widest transition"
      >
        <span aria-hidden>←</span>{" "}
        Discover
      </Link>

      <Link href="/" aria-label="MOTR home" className="shrink-0">
        <Image src="/motr-logo.png" alt="MOTR" width={325} height={145} className="h-8 w-auto" />
      </Link>
    </div>
  );
}
