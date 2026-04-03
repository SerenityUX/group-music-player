import { useEffect, useRef } from "react";
import { getOrCreateGraph } from "../../lib/audioGraph";

interface Ripple {
  x: number;
  y: number;
  birth: number;
  maxRadius: number;
}

const RIPPLE_DURATION = 2000;
const COOLDOWN_MS = 250;
const MAX_RIPPLES = 16;

export default function AudioRipples({
  audioRef,
  isPlaying,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ripplesRef = useRef<Ripple[]>([]);
  const isPlayingRef = useRef(isPlaying);
  const lastSpawnRef = useRef(0);
  const smoothedPeakRef = useRef(0);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * 2 || canvas.height !== h * 2) {
        canvas.width = w * 2;
        canvas.height = h * 2;
      }
      ctx2d.setTransform(2, 0, 0, 2, 0, 0);
      ctx2d.clearRect(0, 0, w, h);

      const now = performance.now();
      const playing = isPlayingRef.current;
      const audio = audioRef.current;

      if (playing && audio) {
        const graph = getOrCreateGraph(audio);
        if (graph) {
          const { ctx: audioCtx, analyser } = graph;
          if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);

          let maxBin = 0;
          for (let i = 0; i < data.length; i++) {
            if (data[i] > maxBin) maxBin = data[i];
          }
          const peak = maxBin / 255;

          const smoothed = smoothedPeakRef.current;
          smoothedPeakRef.current = smoothed * 0.95 + peak * 0.05;

          const spike = peak - smoothedPeakRef.current;

          if (
            spike > 0.08 &&
            peak > 0.6 &&
            now - lastSpawnRef.current > COOLDOWN_MS &&
            ripplesRef.current.length < MAX_RIPPLES
          ) {
            lastSpawnRef.current = now;
            const count = spike > 0.2 ? 2 : 1;
            for (let c = 0; c < count; c++) {
              ripplesRef.current.push({
                x: Math.random() * w,
                y: Math.random() * h,
                birth: now,
                maxRadius: 200 + Math.random() * 350,
              });
            }
          }
        }
      }

      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = now - r.birth;
        if (age > RIPPLE_DURATION) {
          ripples.splice(i, 1);
          continue;
        }
        const t = age / RIPPLE_DURATION;
        const easeOut = 1 - (1 - t) * (1 - t);
        const radius = r.maxRadius * easeOut;
        const opacity = 0.4 * (1 - t);

        ctx2d.beginPath();
        ctx2d.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx2d.strokeStyle = `rgba(0, 203, 91, ${opacity})`;
        ctx2d.lineWidth = 2 + (1 - t) * 4;
        ctx2d.stroke();
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
      aria-hidden
    />
  );
}
