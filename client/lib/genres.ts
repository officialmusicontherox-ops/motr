// Fixed list so artist-selected genres and curator-selected genres always
// match exactly — routing does a straight containment check, not fuzzy text.
export const GENRES = [
  "Hip-Hop / Rap",
  "R&B / Soul",
  "Pop",
  "Indie / Alternative",
  "Rock",
  "Electronic / Dance",
  "House / Techno",
  "Country / Americana",
  "Jazz",
  "Latin",
  "Afrobeats",
  "Metal / Punk",
  "Folk / Acoustic",
  "Ambient / Experimental",
  // Added 2026-08-13. Christian and gospel are a large, well-organised scene
  // with their own playlists, stations and press, and filing them under Pop
  // sent them to curators who don't cover the music.
  "Christian / Gospel",
] as const;

export type Genre = (typeof GENRES)[number];

/** What kind of outlet a curator runs — drives how you verify them. */
export const OUTLET_TYPES = [
  "Spotify playlist",
  "Apple Music playlist",
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "YouTube channel",
  "Blog / zine",
  "Radio show",
  "Podcast",
  "Newsletter",
] as const;

export type OutletType = (typeof OUTLET_TYPES)[number];
