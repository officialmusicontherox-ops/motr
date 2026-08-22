/**
 * The loading indicator.
 *
 * Was a crown, which said nothing about music and read as a badge rather than
 * a wait. Bars rising and falling are unmistakable at any size, and movement
 * is what tells someone the app is working rather than stuck — a pulsing icon
 * can read as decoration.
 *
 * Bars are staggered so they never rise as one block, which looks mechanical.
 */
export default function Equalizer({
  className = "h-10 w-10",
  bars = 4,
}: {
  className?: string;
  bars?: number;
}) {
  // Uneven durations stop the pattern repeating in an obvious loop.
  const timings = [520, 700, 600, 780, 640];

  return (
    <span
      className={`inline-flex items-end justify-center gap-[0.14em] ${className}`}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="bg-gold w-[0.16em] flex-1 origin-bottom rounded-full"
          style={{
            height: "100%",
            animation: `motr-bar ${timings[i % timings.length]}ms ease-in-out ${i * 110}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}
