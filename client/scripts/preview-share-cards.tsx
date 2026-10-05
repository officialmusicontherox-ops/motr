import React from "react";
import fs from "fs";
import { renderShareCard } from "../lib/shareCard";

/**
 * Renders the share cards to PNGs so they can be looked at.
 *
 * Worth having: the first version shipped with the code running off the right
 * edge of the square card and the whole story layout collapsed, neither of
 * which a type check or a status code would ever have caught.
 *
 *   npx tsx scripts/preview-share-cards.tsx [outDir]
 */

const OUT = process.argv[2] ?? ".";

async function main() {
  void React;
  for (const [square, name, title] of [
    [true, "sq-short", "One Last Time"],
    [true, "sq-long", "Carrying the Weight of it All"],
    [false, "story-short", "One Last Time"],
  ] as const) {
    const res = await renderShareCard({
      trackId: "cmuhda2rk000109l3pitz09li",
      title,
      artistName: "Luke Bayne",
      square,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(`${OUT}/${name}.png`, buf);
    console.log(`${name}: ${buf.length} bytes`);
  }
}
main();
