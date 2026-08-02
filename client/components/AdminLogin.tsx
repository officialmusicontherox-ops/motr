"use client";

import { useState } from "react";
import { Crown, Eye, EyeOff } from "./icons";

export default function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, totp }),
    });
    setPending(false);

    if (!res.ok) {
      setError((await res.json()).error ?? "Login failed");
      setTotp("");
      return;
    }
    onAuthenticated();
  }

  return (
    <main className="bg-bg flex min-h-screen items-center justify-center px-6 py-12">
      <form
        onSubmit={submit}
        className="border-edge bg-surface flex w-full max-w-sm flex-col gap-4 rounded-2xl border p-8"
      >
        <div className="text-center">
          <Crown className="text-gold mx-auto h-8 w-8" />
          <h1 className="font-display mt-3 text-2xl uppercase tracking-wide">Admin</h1>
          <p className="text-muted mt-1 text-sm">Password plus your authenticator code.</p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="username"
          aria-label="Email"
          className="border-edge bg-bg focus:border-gold rounded-lg border px-4 py-2.5 outline-none transition placeholder:text-neutral-600"
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            aria-label="Password"
            className="border-edge bg-bg focus:border-gold w-full rounded-lg border py-2.5 pl-4 pr-12 outline-none transition placeholder:text-neutral-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="text-muted hover:text-gold absolute right-3 top-1/2 -translate-y-1/2 p-1 transition"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <input
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Authenticator code"
          className="border-edge bg-bg focus:border-gold rounded-lg border px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] outline-none transition placeholder:text-neutral-700"
        />

        <button
          type="submit"
          disabled={pending || totp.length !== 6}
          className="bg-gold text-bg rounded-lg px-4 py-3 font-bold uppercase tracking-wide transition hover:brightness-110 disabled:opacity-30"
        >
          {pending ? "Verifying..." : "Sign in"}
        </button>

        {error && <p className="text-nope text-sm">{error}</p>}
      </form>
    </main>
  );
}
