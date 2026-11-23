import ArtistPortal from "./ArtistPortal";

export const metadata = {
  title: "Your artist page on MOTR",
  // Private to each artist, and nothing here is useful without signing in.
  robots: { index: false, follow: false },
};

export default function ArtistPage() {
  return (
    // The page draws the MOTR header and menu itself, like the others.
    <ArtistPortal />
  );
}
