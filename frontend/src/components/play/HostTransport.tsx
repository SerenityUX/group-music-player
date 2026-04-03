import IconImg from "../ui/IconImg";

interface HostTransportProps {
  isPlaying: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  /** No track loaded — only play is useful (starts first queued song). */
  idle?: boolean;
  /** No current track (empty queue or finished queue) — center shows add; prev/next disabled */
  showAddMusicCenter?: boolean;
  onAddSong?: () => void;
  /** Desktop host 2-col: slightly tighter row */
  compact?: boolean;
  /** Less vertical padding before reactions (e.g. mobile host) */
  tight?: boolean;
}

const disabledBtn = "cursor-not-allowed opacity-40 hover:bg-white active:bg-white";

const sideBase =
  "inline-flex shrink-0 items-center justify-center rounded-full border border-app-border bg-white hover:bg-app-surface active:bg-app-surface";

/** Play/pause: always dark brand green, light (white) icon */
const centerPlay =
  "inline-flex shrink-0 items-center justify-center rounded-full border border-app-primaryGreen bg-app-primaryGreen hover:bg-[#00b34a] active:bg-[#009a42]";

const iconLight = "brightness-0 invert";

export default function HostTransport({
  isPlaying,
  onPrev,
  onPlayPause,
  onNext,
  idle,
  showAddMusicCenter = false,
  onAddSong,
  compact,
  tight,
}: HostTransportProps) {
  const gap = compact ? "gap-4" : "gap-6";
  const py = compact ? "py-0" : tight ? "py-2" : "py-4";

  const sideSize = compact ? "h-[2.7rem] w-[2.7rem]" : "h-[3.2rem] w-[3.2rem]";
  const playSize = compact ? "h-[3.15rem] w-[3.15rem]" : "h-[4.5rem] w-[4.5rem]";
  const prevNextIcon = compact ? "h-[1.125rem] w-[1.125rem]" : "h-[1.6rem] w-[1.6rem]";
  const playIcon = compact ? "h-[1.575rem] w-[1.575rem]" : "h-10 w-10";

  const sidesDisabled = Boolean(idle || showAddMusicCenter);

  const centerIsAdd = showAddMusicCenter && onAddSong;

  return (
    <div className={`flex items-center justify-center ${gap} ${py}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={sidesDisabled}
        className={`${sideBase} ${sideSize} ${sidesDisabled ? disabledBtn : ""}`}
        aria-label="Previous"
      >
        <IconImg src="/icons/back.svg" className={`pointer-events-none ${prevNextIcon}`} />
      </button>
      {centerIsAdd ? (
        <button
          type="button"
          onClick={onAddSong}
          className={`${sideBase} ${playSize}`}
          aria-label="Add song"
        >
          <IconImg src="/icons/MusicIcon.svg" className={`pointer-events-none ${playIcon}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPlayPause}
          className={`${centerPlay} ${playSize}`}
          aria-label={isPlaying ? "Pause" : "Play"}
          aria-pressed={isPlaying}
        >
          <IconImg
            src={isPlaying ? "/icons/pause.svg" : "/icons/playButton.svg"}
            className={`pointer-events-none ${playIcon} ${iconLight}`}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={sidesDisabled}
        className={`${sideBase} ${sideSize} ${sidesDisabled ? disabledBtn : ""}`}
        aria-label="Next"
      >
        <IconImg src="/icons/forward.svg" className={`pointer-events-none ${prevNextIcon}`} />
      </button>
    </div>
  );
}
