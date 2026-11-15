import { useId } from "react";

/**
 * Lettering drawn as a lit neon tube, in the MOTR logo's own colours.
 *
 * The logo is hand-painted and cannot be set as type, but what makes it read
 * as MOTR is the tube itself: a hollow outline, a hot white core, a soft
 * bloom around it, and the run of colour from pink through orange and purple
 * to blue. Those four things are reproduced here, on the display face the
 * rest of the app already uses, leaning the same way the logo does.
 *
 * Three strokes of the same text stacked: a wide blurred one for the bloom,
 * the coloured tube, and a thin near-white line down its middle.
 */

/** The logo's colours, left to right. */
export const NEON = {
  pink: "#ff2d9b",
  orange: "#ff8a2b",
  purple: "#a855f7",
  blue: "#3aa8ff",
} as const;

export function NeonText({
  text,
  colors = [NEON.pink, NEON.orange, NEON.purple, NEON.blue],
  width,
  height = 64,
  fontSize = 52,
  className,
  underline = false,
}: {
  text: string;
  colors?: string[];
  /** In viewBox units. Roughly 0.56 of the font size per letter on Anton. */
  width: number;
  height?: number;
  fontSize?: number;
  className?: string;
  /** The brush stroke under the logo, for a title. */
  underline?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const h = underline ? height + 12 : height;
  const common = {
    x: width / 2,
    y: height - 14,
    textAnchor: "middle" as const,
    fontSize,
    fill: "none",
    strokeLinejoin: "round" as const,
    style: { fontFamily: "var(--font-display), sans-serif" },
    transform: `skewX(-9)`,
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      className={className}
      role="img"
      aria-label={text}
      // The lean shifts the letters left of centre; this puts them back.
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          {colors.map((c, i) => (
            <stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        <filter id={`b${id}`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g transform={`translate(${(height - 14) * 0.158}, 0)`}>
        <text {...common} stroke={`url(#g${id})`} strokeWidth={7} filter={`url(#b${id})`} opacity={0.85}>
          {text}
        </text>
        <text {...common} stroke={`url(#g${id})`} strokeWidth={3}>
          {text}
        </text>
        <text {...common} stroke="#fff" strokeWidth={0.9} opacity={0.85}>
          {text}
        </text>
      </g>

      {underline && (
        <>
          <path
            d={`M ${width * 0.08} ${h - 5} Q ${width * 0.5} ${h - 14} ${width * 0.92} ${h - 7}`}
            stroke={`url(#g${id})`}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            filter={`url(#b${id})`}
            opacity={0.8}
          />
          <path
            d={`M ${width * 0.08} ${h - 5} Q ${width * 0.5} ${h - 14} ${width * 0.92} ${h - 7}`}
            stroke={`url(#g${id})`}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}
