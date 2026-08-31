"use client";

import { useState } from "react";

/** The click that actually spends the token. */
export default function ConfirmScoutSignIn({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scout/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Ask for a new link.");
        setBusy(false);
        return;
      }
      window.location.href = "/scout";
    } catch {
      setError("Network problem — try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={go}
        disabled={busy}
        className="bg-gold text-bg rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide disabled:opacity-40"
      >
        {busy ? "Signing you in..." : "Sign in"}
      </button>
      {error && <p className="text-nope max-w-xs text-sm">{error}</p>}
    </>
  );
}
