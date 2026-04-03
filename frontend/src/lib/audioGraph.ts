/** One graph per <audio> element (createMediaElementSource may only be called once). */
const audioGraph = new WeakMap<
  HTMLAudioElement,
  { ctx: AudioContext; analyser: AnalyserNode; source: MediaElementAudioSourceNode }
>();

export function getOrCreateGraph(audio: HTMLAudioElement): { ctx: AudioContext; analyser: AnalyserNode } | null {
  const existing = audioGraph.get(audio);
  if (existing) return existing;

  try {
    audio.crossOrigin = "anonymous";
  } catch {
    /* ignore */
  }

  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  try {
    const ctx = new AC();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.62;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const g = { ctx, analyser, source };
    audioGraph.set(audio, g);
    return g;
  } catch {
    return null;
  }
}

export function avgFreq(data: Uint8Array, start: number, end: number): number {
  const e = Math.min(Math.max(start, 0), data.length);
  const f = Math.min(Math.max(end, e), data.length);
  if (f <= e) return 0;
  let sum = 0;
  for (let i = e; i < f; i++) sum += data[i];
  return sum / (f - e);
}
