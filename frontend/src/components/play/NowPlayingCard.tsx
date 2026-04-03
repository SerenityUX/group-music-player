import type { RefObject } from "react";
import CompactAudioVisualizer from "./CompactAudioVisualizer";

/** Desktop host: keep artist portion readable; full string still ellipsis in one line via CSS */
const DESKTOP_HOST_ARTIST_MAX = 48;

function clipArtistNameForDesktop(name: string): string {
  if (name.length <= DESKTOP_HOST_ARTIST_MAX) return name;
  return `${name.slice(0, DESKTOP_HOST_ARTIST_MAX - 1)}…`;
}

interface NowPlayingCardProps {
  imageUrl: string | null;
  songName: string;
  artistName: string;
  addedBy?: string | null;
  waitingForDownload?: boolean;
  downloadFailed?: boolean;
  compact?: boolean;
  /** Desktop host 2-col: art + text sized for half-width card */
  desktopHost?: boolean;
  /** Passenger view: drive the compact EQ bars from the shared &lt;audio&gt; element */
  audioRef?: RefObject<HTMLAudioElement | null>;
  isPlaying?: boolean;
}

export default function NowPlayingCard({
  imageUrl,
  songName,
  artistName,
  addedBy,
  waitingForDownload,
  downloadFailed,
  compact,
  desktopHost,
  audioRef,
  isPlaying,
}: NowPlayingCardProps) {
  const cover = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-app-surface ${
        compact
          ? "h-16 w-16"
          : desktopHost
            ? "mx-auto aspect-square w-full max-w-[min(100%,11rem)]"
            : "mx-auto aspect-square w-full max-w-[312px]"
      }`}
    >
      {imageUrl && <img src={imageUrl} alt="" className={`h-full w-full object-cover ${downloadFailed ? "opacity-40" : ""}`} />}
      {waitingForDownload && !downloadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
          Downloading...
        </div>
      )}
      {downloadFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/60 text-white">
          <span className="text-2xl">✕</span>
          <span className="mt-1 text-xs font-semibold">Download Failed</span>
        </div>
      )}
    </div>
  );

  const artistForLine = desktopHost ? clipArtistNameForDesktop(artistName) : artistName;
  const artistLine =
    addedBy != null && addedBy !== ""
      ? `${artistForLine} · added by ${addedBy}`
      : artistForLine;
  const artistLineFull =
    addedBy != null && addedBy !== ""
      ? `${artistName} · added by ${addedBy}`
      : artistName;

  const text = (
    <div
      className={
        compact ? "min-w-0 flex-1 text-left" : desktopHost ? "min-w-0 text-center" : "text-center"
      }
    >
      <p
        title={desktopHost ? songName : undefined}
        className={`font-semibold ${compact ? "text-base" : desktopHost ? "mt-0 line-clamp-2 max-w-full min-w-0 break-words text-center text-sm leading-snug" : "mt-4 text-xl"}`}
      >
        {songName}
      </p>
      <p
        title={desktopHost ? artistLineFull : artistLine}
        className={`text-neutral-600 ${compact ? "text-sm" : desktopHost ? "mt-0.5 max-w-full truncate text-xs" : "mt-1"}`}
      >
        {artistLine}
      </p>
    </div>
  );

  if (desktopHost) {
    return (
      <div className="flex min-w-0 flex-col items-center px-1">
        {cover}
        <div className="mt-1.5 w-full min-w-0 max-w-[min(100%,11rem)]">{text}</div>
      </div>
    );
  }

  if (compact) {
    const showViz = Boolean(audioRef && !waitingForDownload && !downloadFailed);
    return (
      <div className="flex items-center gap-4">
        {cover}
        <div className="min-w-0 flex-1">{text}</div>
        {showViz && audioRef && (
          <CompactAudioVisualizer audioRef={audioRef} isPlaying={Boolean(isPlaying)} />
        )}
      </div>
    );
  }

  return (
    <div>
      {cover}
      {text}
    </div>
  );
}
