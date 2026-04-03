import IconImg from "../ui/IconImg";
import MaskedIcon from "../ui/MaskedIcon";

interface TripleReactionButtonsProps {
  onClap: () => void;
  onShit: () => void;
  onLeaderboard: () => void;
  /** Current user's reaction on this track, if any */
  activeReaction?: "Claps" | "Shit" | null;
  /** No song playing — dimmed, disabled, non-interactive (same idea as transport prev/next) */
  idle?: boolean;
  /** Desktop host 2-col */
  compact?: boolean;
  /** Mobile host: smaller rings vs transport, tighter row */
  hostMobile?: boolean;
  /** Desktop passenger: larger than host compact */
  passengerDesktop?: boolean;
}

/** Same circle + hover as HostTransport play / prev / next */
const circleDefault =
  "inline-flex shrink-0 items-center justify-center rounded-full border border-app-border bg-white hover:bg-app-surface active:bg-app-surface";

/** Selected reaction: light green fill, icon in brand green */
const circleSelected =
  "inline-flex shrink-0 items-center justify-center rounded-full border border-app-mediumGreen bg-app-lightGreen hover:bg-[#dff5e6] active:bg-app-lightGreen";

const disabledBtn = "cursor-not-allowed opacity-40 hover:bg-white active:bg-white";

export default function TripleReactionButtons({
  onClap,
  onShit,
  onLeaderboard,
  activeReaction = null,
  idle = false,
  compact = false,
  hostMobile = false,
  passengerDesktop = false,
}: TripleReactionButtonsProps) {
  const ring = compact
    ? "h-9 w-9"
    : passengerDesktop
      ? "h-12 w-12"
      : hostMobile
        ? "h-12 w-12"
        : "h-[72px] w-[72px]";
  const icon = compact
    ? "h-[18px] w-[18px]"
    : passengerDesktop
      ? "h-6 w-6"
      : hostMobile
        ? "h-6 w-6"
        : "h-11 w-11";
  const gap = compact ? "gap-1.5" : passengerDesktop ? "gap-3" : hostMobile ? "gap-4" : "gap-6";

  const clapSelected = !idle && activeReaction === "Claps";
  const shitSelected = !idle && activeReaction === "Shit";

  return (
    <div className={`flex justify-center ${gap} ${compact || hostMobile || passengerDesktop ? "py-0" : "py-2"}`}>
      <button
        type="button"
        onClick={onClap}
        disabled={idle}
        className={`${ring} ${idle ? `${circleDefault} ${disabledBtn}` : clapSelected ? circleSelected : circleDefault}`}
        aria-label="Clap"
        aria-pressed={clapSelected}
      >
        {clapSelected ? (
          <MaskedIcon src="/icons/clap.svg" className={`pointer-events-none ${icon}`} />
        ) : (
          <IconImg src="/icons/clap.svg" className={`pointer-events-none ${icon}`} alt="" />
        )}
      </button>
      <button
        type="button"
        onClick={onShit}
        disabled={idle}
        className={`${ring} ${idle ? `${circleDefault} ${disabledBtn}` : shitSelected ? circleSelected : circleDefault}`}
        aria-label="Shit"
        aria-pressed={shitSelected}
      >
        {shitSelected ? (
          <MaskedIcon src="/icons/shit.svg" className={`pointer-events-none ${icon}`} />
        ) : (
          <IconImg src="/icons/shit.svg" className={`pointer-events-none ${icon}`} alt="" />
        )}
      </button>
      <button
        type="button"
        onClick={onLeaderboard}
        className={`${ring} inline-flex shrink-0 items-center justify-center rounded-full border border-app-primaryGreen bg-white hover:bg-app-surface active:bg-app-surface`}
        aria-label="Leaderboard"
      >
        <MaskedIcon src="/icons/crown.svg" className={`pointer-events-none ${icon}`} />
      </button>
    </div>
  );
}
