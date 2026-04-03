import { useEffect, useRef } from "react";
import { getOrCreateGraph, avgFreq } from "../../lib/audioGraph";

function scaleEnergy(v: number, playing: boolean): number {
  if (!playing) return 6;
  const n = v / 255;
  return 8 + n * 26;
}

export default function CompactAudioVisualizer({
  audioRef,
  isPlaying,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const smoothed = useRef<[number, number, number]>([6, 8, 6]);
  const fakeT = useRef(0);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const graph = getOrCreateGraph(audio);
    const data = graph ? new Uint8Array(graph.analyser.frequencyBinCount) : null;
    const LERP = 0.25;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const playing = isPlayingRef.current;

      let targets: [number, number, number];

      if (!graph || !data) {
        fakeT.current += 0.12;
        const t = fakeT.current;
        if (!playing) {
          targets = [6, 8, 6];
        } else {
          targets = [
            scaleEnergy(90 + Math.sin(t * 4) * 40 + Math.sin(t * 11) * 25, true),
            scaleEnergy(110 + Math.sin(t * 3.2) * 50 + Math.sin(t * 9) * 30, true),
            scaleEnergy(90 + Math.sin(t * 4.1) * 40 + Math.sin(t * 10) * 25, true),
          ];
        }
      } else {
        const { ctx, analyser } = graph;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        analyser.getByteFrequencyData(data);
        const n = data.length;

        if (!playing) {
          targets = [6, 8, 6];
        } else {
          const low = avgFreq(data, 1, Math.max(4, Math.floor(n * 0.1)));
          const mid = avgFreq(data, Math.floor(n * 0.08), Math.floor(n * 0.22));
          const high = avgFreq(data, Math.floor(n * 0.18), Math.floor(n * 0.42));
          targets = [scaleEnergy(mid, true), scaleEnergy(low, true), scaleEnergy(high, true)];
        }
      }

      for (let i = 0; i < 3; i++) {
        smoothed.current[i] += (targets[i] - smoothed.current[i]) * LERP;
        const el = barRefs.current[i];
        if (el) el.style.height = `${smoothed.current[i]}px`;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioRef]);

  return (
    <div
      className="flex h-[34px] shrink-0 items-center justify-center gap-[5px]"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el; }}
          className="w-1.5 rounded-full bg-neutral-600"
          style={{ height: "6px", minHeight: "4px" }}
        />
      ))}
    </div>
  );
}
