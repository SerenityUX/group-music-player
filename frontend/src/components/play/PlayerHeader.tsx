import { useEffect, useRef, useState, useCallback } from "react";
import IconImg from "../ui/IconImg";

interface PlayerHeaderProps {
  partyName: string;
  peanutScore: number;
  onOpenGroup: () => void;
  onOpenLeaderboard: () => void;
  /** Strip for bottom of desktop host column (border-top only, smaller) */
  variant?: "default" | "footer";
}

let _audioCtx: AudioContext | null = null;
let _clickBuffer: AudioBuffer | null = null;
let _bufferLoading = false;
let _unlocked = false;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

function unlockAudioCtx() {
  if (_unlocked) return;
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  _unlocked = true;
}

if (typeof window !== "undefined") {
  const events = ["touchstart", "touchend", "mousedown", "keydown"] as const;
  const handler = () => {
    unlockAudioCtx();
    loadClickBuffer();
    for (const e of events) window.removeEventListener(e, handler, true);
  };
  for (const e of events) window.addEventListener(e, handler, { capture: true, once: false });
}

async function loadClickBuffer(): Promise<AudioBuffer | null> {
  if (_clickBuffer) return _clickBuffer;
  if (_bufferLoading) return null;
  _bufferLoading = true;
  try {
    const res = await fetch("/penClick.mp3");
    const buf = await res.arrayBuffer();
    _clickBuffer = await getAudioCtx().decodeAudioData(buf);
    return _clickBuffer;
  } catch {
    _bufferLoading = false;
    return null;
  }
}

function playClick() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  if (!_clickBuffer) return;
  const source = ctx.createBufferSource();
  source.buffer = _clickBuffer;
  source.connect(ctx.destination);
  source.start();
}

function useAnimatedScore(target: number) {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  const targetRef = useRef(target);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const tick = useCallback(() => {
    const cur = displayedRef.current;
    const tgt = targetRef.current;
    if (cur === tgt) return;

    const next = cur + (tgt > cur ? 1 : -1);
    playClick();
    displayedRef.current = next;
    setDisplayed(next);

    if (next !== tgt) {
      const dur = _clickBuffer?.duration ?? 0.2;
      timerRef.current = setTimeout(tick, dur * 1000);
    }
  }, []);

  useEffect(() => {
    loadClickBuffer();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      displayedRef.current = target;
      targetRef.current = target;
      setDisplayed(target);
      return;
    }

    targetRef.current = target;
    if (timerRef.current) clearTimeout(timerRef.current);
    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, tick]);

  return displayed;
}

export default function PlayerHeader({
  partyName,
  peanutScore,
  onOpenGroup,
  onOpenLeaderboard,
  variant = "default",
}: PlayerHeaderProps) {
  const isFooter = variant === "footer";
  const displayedScore = useAnimatedScore(peanutScore);

  return (
    <header
      className={
        isFooter
          ? "flex items-center justify-between px-0 pt-2 pb-0"
          : "mb-4 flex items-center justify-between border-b border-app-border pb-4"
      }
    >
      <button
        type="button"
        onClick={onOpenGroup}
        className={`rounded-full hover:bg-app-surface ${isFooter ? "p-1.5" : "p-2"}`}
        aria-label="Group"
      >
        <IconImg src="/icons/group.svg" className={isFooter ? "h-8 w-8" : "h-10 w-10"} />
      </button>
      <h2 className={`truncate text-center font-semibold ${isFooter ? "max-w-[min(100%,11rem)] text-sm" : "max-w-[200px] text-base"}`}>
        {partyName}
      </h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="flex items-center gap-1 text-sm font-semibold tabular-nums hover:opacity-80"
          style={{ color: "#00CB5B", border: "1.5px solid #00CB5B", borderRadius: 8, padding: "4px 10px" }}
          aria-label="Leaderboard"
        >
          <IconImg src="/icons/peanut.svg" className={isFooter ? "h-4 w-4" : "h-4 w-4"} />
          {displayedScore}
        </button>
      </div>
    </header>
  );
}

