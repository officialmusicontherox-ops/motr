import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BADGES } from "@/lib/achievements";

/**
 * The badge graphic, on a black screen and nothing else.
 *
 * Opening the PNG directly looked simpler and was worse: a phone is about
 * 9:19.5 and the graphic is 9:16, so the browser centres it and fills the
 * rest with its own white page. Saving the image was fine, but screenshotting
 * it — which is what people actually do — caught a white band underneath.
 *
 * Black behind it, full width, centred. A screenshot now comes out as the
 * graphic on black, and holding it down still saves the original file.
 */

type Params = { params: Promise<{ badgeId: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return BADGES.map((b) => ({ badgeId: b.id }));
}

export default async function BadgePhotoPage({ params }: Params) {
  const { badgeId } = await params;
  const badge = BADGES.find((b) => b.id === badgeId);
  if (!badge) notFound();

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        backgroundColor: "#09090a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* A plain img on purpose. Hold it down and the browser offers to save
          the original 1080x1920 file, which no wrapper or canvas would. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/achievement-card/${badge.id}?shape=story&v=4`}
        alt={`${badge.name} badge from MOTR`}
        width={1080}
        height={1920}
        /*
         * Capped on both axes so whichever one runs out first is the one that
         * binds. A phone is narrower in proportion than 9:16, so width binds
         * and the graphic sits between two black bands. A desktop window is
         * wider, so height binds and it sits centred between two. Setting
         * width alone fits a phone and then blows the image up to the full
         * width of a monitor, where it runs several screens tall.
         */
        style={{
          maxWidth: "100%",
          maxHeight: "100dvh",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}
