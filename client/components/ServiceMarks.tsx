/** The two services' marks, for the buttons that open a song in each. */

export function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.9-6.8-2.3-11.3-1.3a.8.8 0 1 1-.3-1.5c4.9-1.1 9.1-.6 12.4 1.4.4.2.5.7.3 1.1Zm1.2-2.8a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5a1 1 0 0 1-.6-1.9c4.6-1.4 10.3-.7 14.2 1.7.5.3.6.9.3 1.4Zm.1-2.9C14 8.4 7.7 8.2 4.2 9.2a1.2 1.2 0 1 1-.7-2.3C7.6 5.7 14.5 6 19 8.6a1.2 1.2 0 0 1-1.2 2.1Z" />
    </svg>
  );
}

export function AppleMusicMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.6 2H6.4A4.4 4.4 0 0 0 2 6.4v11.2A4.4 4.4 0 0 0 6.4 22h11.2a4.4 4.4 0 0 0 4.4-4.4V6.4A4.4 4.4 0 0 0 17.6 2Zm-1.1 3.9v8.6a2.4 2.4 0 0 1-1.9 2.4c-1.2.2-2.1-.5-2.1-1.5s.7-1.7 1.8-1.9l.7-.1c.4-.1.5-.2.5-.6V8.6c0-.3-.1-.4-.4-.3l-4 .8c-.3.1-.4.2-.4.5v6.9a2.4 2.4 0 0 1-1.9 2.4c-1.2.2-2.1-.5-2.1-1.5s.7-1.7 1.8-1.9l.7-.1c.4-.1.5-.2.5-.6V7.4c0-.6.3-.9.9-1l5.9-1.2c.6-.1 1 .2 1 .8v-.1Z" />
    </svg>
  );
}
