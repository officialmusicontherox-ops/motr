/**
 * Inline SVG rather than emoji — emoji render differently on every platform
 * and can't take brand color. The crown is the through-line from the logo.
 */

type IconProps = { className?: string };

export function Crown({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 18" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1.6 4.2c.9 0 1.6.8 1.6 1.7 0 .5-.2 1-.6 1.3l2.2 4.1 3.5-6.1a1.7 1.7 0 0 1-.7-1.4c0-1 .7-1.8 1.6-1.8s1.6.8 1.6 1.8c0 .5-.2 1-.6 1.3L12 8l1.8-2.9a1.7 1.7 0 0 1-.6-1.3c0-1 .7-1.8 1.6-1.8s1.6.8 1.6 1.8c0 .6-.3 1.1-.7 1.4l3.5 6.1 2.2-4.1a1.7 1.7 0 0 1-.6-1.3c0-.9.7-1.7 1.6-1.7s1.6.8 1.6 1.7-.6 1.6-1.4 1.7L21 17H3L1.4 7.6C.6 7.5 0 6.9 0 6c0-1 .7-1.8 1.6-1.8Z" />
    </svg>
  );
}

export function Heart({ className = "h-6 w-6", filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21s-7.5-4.7-9.6-9A5.4 5.4 0 0 1 12 6.3 5.4 5.4 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9Z" />
    </svg>
  );
}

export function Cross({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Play({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.5v13a.7.7 0 0 0 1.1.6l10-6.5a.7.7 0 0 0 0-1.2l-10-6.5A.7.7 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function Pause({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}

export function Bookmark({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.5-7 4.5v-16a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function Sliders({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function Eye({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOff({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 7.8A17 17 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function Plus({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Check({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function Menu({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function ArrowOut({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function Waveform({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 10v4M8 6v12M12 8v8M16 4v16M20 10v4" />
    </svg>
  );
}
