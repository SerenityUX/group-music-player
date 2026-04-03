import { useCallback, type AnimationEvent } from "react";

const DISPLAY_MS = 4200;

interface ReactionGifBurstItemProps {
  burstId: string;
  gifUrl: string;
  /** 0–100, horizontal anchor (center of GIF) */
  leftPct: number;
  /** 0–100, vertical anchor (center of GIF) */
  topPct: number;
  onDismiss: (id: string) => void;
}

/**
 * One animated GIF in a burst layer (parent provides full-screen stacking container).
 */
export default function ReactionGifBurstItem({ burstId, gifUrl, leftPct, topPct, onDismiss }: ReactionGifBurstItemProps) {
  const handleAnimationEnd = useCallback(
    (e: AnimationEvent<HTMLImageElement>) => {
      if (e.animationName === "reaction-gif-burst") onDismiss(burstId);
    },
    [onDismiss, burstId]
  );

  return (
    <img
      src={gifUrl}
      alt=""
      className="absolute max-h-[40vh] max-w-[min(92vw,360px)] select-none object-contain drop-shadow-lg"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        animation: `reaction-gif-burst ${DISPLAY_MS}ms linear forwards`,
      }}
      onAnimationEnd={handleAnimationEnd}
      draggable={false}
    />
  );
}
