import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "MOTR — Music On The Rox",
  description:
    "Swipe through 30-second clips. The tracks fans love get pushed to curators — no labels, no payola.",
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
        {children}
      </body>
    </html>
  );
}
