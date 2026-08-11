-- Podcasts sit alongside radio: an episode plays or discusses the track, and
-- the proof is the episode itself, timestamped. Held like the others, because
-- an episode can be unpublished the same way a playlist add can be pulled.
ALTER TYPE "FeatureType" ADD VALUE 'PODCAST';
