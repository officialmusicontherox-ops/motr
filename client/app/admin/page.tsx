"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [admin, setAdmin] = useState<{ id: string; email: string } | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/session");
    setAdmin(res.ok ? (await res.json()).admin : null);
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!checked) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </main>
    );
  }

  return admin ? (
    <AdminDashboard admin={admin} onLogout={refresh} />
  ) : (
    <AdminLogin onAuthenticated={refresh} />
  );
}
