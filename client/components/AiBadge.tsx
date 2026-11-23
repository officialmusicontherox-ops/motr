/**
 * A small "AI" mark on the artwork of any song whose artist declared AI
 * vocals, so listeners know what they are hearing.
 *
 * Driven only by the song's AI setting: anything marked AI, at submission
 * or later from the admin panel, carries it, and nothing else does. Sits
 * in a top corner, takes no clicks, and is sized for where it is shown.
 */
export default function AiBadge({ on, size = "md" }: { on: boolean | null | undefined; size?: "sm" | "md" }) {
  if (!on) return null;
  const sm = size === "sm";
  return (
    <span
      aria-label="AI vocals"
      title="AI vocals"
      // Small and quiet on purpose: a note for the listener, not a
      // warning stamped on the artist's cover.
      className={`pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-black/55 font-semibold leading-none text-white/90 ring-1 ring-white/25 ${
        sm ? "right-0.5 top-0.5 h-3.5 w-3.5 text-[0.36rem]" : "right-1.5 top-1.5 h-5 w-5 text-[0.48rem]"
      }`}
    >
      AI
    </span>
  );
}
