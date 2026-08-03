import type { Metadata } from "next";

/**
 * The dashboard is a client component and so can't declare metadata itself.
 * This layout exists only to mark it noindex — belt and braces alongside
 * robots.txt, since a header is obeyed even if a link leaks somewhere
 * crawlable.
 */
export const metadata: Metadata = {
  title: "Admin — MOTR",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
