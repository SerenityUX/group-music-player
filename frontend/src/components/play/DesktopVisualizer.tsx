import { useEffect, useRef } from "react";
import { getOrCreateGraph } from "../../lib/audioGraph";

const BAR_COUNT = 32;
const MAX_HEIGHT = 120;
const MIN_HEIGHT = 4;
const BAR_GAP = 3;

export default function DesktopVisualizer({
  audioRef,
  isPlaying,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  const fakeT = useRef(0);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const graph = audio ? getOrCreateGraph(audio) : null;
    const data = graph ? new Uint8Array(graph.analyser.frequencyBinCount) : null;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const playing = isPlayingRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * 2 || canvas.height !== h * 2) {
        canvas.width = w * 2;
        canvas.height = h * 2;
      }
      ctx2d.setTransform(2, 0, 0, 2, 0, 0);
      ctx2d.clearRect(0, 0, w, h);

      const barWidth = Math.max(2, (w - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT);
      const totalWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * BAR_GAP;
      const offsetX = (w - totalWidth) / 2;

      if (graph && data) {
        const { ctx: audioCtx, analyser } = graph;
        if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        analyser.getByteFrequencyData(data);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let energy: number;

        if (!playing) {
          energy = MIN_HEIGHT;
        } else if (data && data.length > 0) {
          const binStart = Math.floor((i / BAR_COUNT) * data.length * 0.6);
          const binEnd = Math.floor(((i + 1) / BAR_COUNT) * data.length * 0.6);
          let sum = 0;
          let count = 0;
          for (let b = binStart; b < binEnd && b < data.length; b++) {
            sum += data[b];
            count++;
          }
          const avg = count > 0 ? sum / count : 0;
          energy = MIN_HEIGHT + (avg / 255) * (MAX_HEIGHT - MIN_HEIGHT);
        } else {
          fakeT.current += 0.002;
          const t = fakeT.current;
          const phase = (i / BAR_COUNT) * Math.PI * 2;
          const v = 80 + Math.sin(t * 4 + phase) * 40 + Math.sin(t * 11 + phase * 0.7) * 30;
          energy = MIN_HEIGHT + (v / 255) * (MAX_HEIGHT - MIN_HEIGHT);
        }

        const barH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, energy));
        const x = offsetX + i * (barWidth + BAR_GAP);
        const y = h - barH;

        const gradient = ctx2d.createLinearGradient(x, h, x, y);
        gradient.addColorStop(0, "rgba(0, 203, 91, 0.7)");
        gradient.addColorStop(1, "rgba(0, 203, 91, 0.15)");
        ctx2d.fillStyle = gradient;

        const radius = Math.min(barWidth / 2, 3);
        ctx2d.beginPath();
        ctx2d.moveTo(x, h);
        ctx2d.lineTo(x, y + radius);
        ctx2d.quadraticCurveTo(x, y, x + radius, y);
        ctx2d.lineTo(x + barWidth - radius, y);
        ctx2d.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx2d.lineTo(x + barWidth, h);
        ctx2d.closePath();
        ctx2d.fill();
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none h-full w-full"
      aria-hidden
    />
  );
}
