import ArtistPortal from "./ArtistPortal";

export const metadata = {
  title: "Your page — MOTR",
  // Private to each artist, and nothing here is useful without signing in.
  robots: { index: false, follow: false },
};

export default function ArtistPage() {
  return (
    <main className="bg-bg text-ink min-h-screen px-5">
      <ArtistPortal />
    </main>
  );
}
