import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import ClientErrorReporter from "@/components/ClientErrorReporter";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Condensed heavy display face — stands in for the brush lettering on
// headings and the NOPE / LIKE callouts.
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const SITE = "https://app.musicontherox.com";
const DESCRIPTION =
  "Swipe through 30-second clips. The tracks fans push hardest go to real curators — no labels, no payola.";

export const metadata: Metadata = {
  // Required for the share image below: without it, social platforms get a
  // relative path they can't fetch, and the preview comes out blank.
  metadataBase: new URL(SITE),
  title: "MOTR — Music On The Rox",
  description: DESCRIPTION,

  // What Instagram, Facebook, iMessage, WhatsApp and the rest show when
  // someone pastes the link. Absent, they show nothing at all.
  openGraph: {
    type: "website",
    siteName: "MOTR",
    title: "MOTR — Music On The Rox",
    description: DESCRIPTION,
    url: SITE,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MOTR — find your next favorite song",
      },
    ],
  },

  // Points every page at the real domain, so the Vercel hostname can never
  // compete with it in search results.
  alternates: { canonical: "/" },

  twitter: {
    card: "summary_large_image",
    title: "MOTR — Music On The Rox",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  // Lets iOS install MOTR to the home screen and open it without Safari's
  // chrome; Android/desktop read the same intent from app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "MOTR",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  // Installed windows must clear the notch/home indicator themselves.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable} h-full antialiased`}>
      {/* Browser extensions (Grammarly et al.) inject data-* attributes onto
          <body> after SSR, which React reports as a hydration mismatch. This
          suppresses that one-level diff only — it does not hide real
          mismatches inside the app. */}
      <body suppressHydrationWarning className="bg-bg text-white flex min-h-full flex-col">
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
