import ScoutPortal from "./ScoutPortal";

export const metadata = {
  title: "MOTR A&R",
  // Not somewhere search engines should send anyone: it is a paid, invite-only
  // view of data about other people's music.
  robots: { index: false, follow: false },
};

export default function ScoutPage() {
  return (
    <main className="bg-bg min-h-screen text-ink">
      <ScoutPortal />
    </main>
  );
}
