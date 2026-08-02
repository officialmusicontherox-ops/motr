const BAR_COUNT = 48;

// Real amplitude peaks decoded from the audio, when the source allows it
// (CORS-permitting). Preview CDNs vary in whether they send
// Access-Control-Allow-Origin, so callers should fall back to
// `fallbackPeaks` when this throws.
export async function decodePeaks(url: string): Promise<number[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const samplesPerBar = Math.floor(channel.length / BAR_COUNT);
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      for (let j = start; j < start + samplesPerBar; j++) {
        const abs = Math.abs(channel[j] ?? 0);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }
    const normalizer = Math.max(...peaks, 0.01);
    return peaks.map((p) => Math.max(0.08, p / normalizer));
  } finally {
    ctx.close();
  }
}

// Deterministic stand-in shape when we can't read the real audio bytes
// (e.g. the preview host doesn't send CORS headers). Seeded by track id so
// a given track always renders the same "waveform" instead of jittering.
export function fallbackPeaks(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const peaks: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) | 0;
    const rand = ((h >>> 0) % 1000) / 1000;
    const wave = Math.sin(i / 4) * 0.3 + 0.5;
    peaks.push(Math.max(0.08, Math.min(1, wave + rand * 0.3)));
  }
  return peaks;
}

export { BAR_COUNT };
