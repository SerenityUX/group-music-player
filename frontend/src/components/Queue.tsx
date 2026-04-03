import { useEffect, useRef, useState } from "react";
import { useMasterAudioPreviewOptional } from "../context/MasterAudioPreviewContext";
import { getSocket } from "../lib/socket";
import { API_URL } from "../lib/config";
import SearchModal from "./SearchModal";
import SongSearchPanel from "./search/SongSearchPanel";

interface QueueItem {
  id: number;
  position: number;
  song: {
    id: number;
    song_name: string;
    artist_name: string;
    image_path: string | null;
    download_status: string;
    preview_url?: string | null;
  };
  added_by_session: { name: string };
}

interface QueueProps {
  partyId: string;
  currentQueueItemId: number | null;
  /** Controlled search modal (used with PlayView guest “Add Song”) */
  searchModalOpen?: boolean;
  onSearchModalOpenChange?: (open: boolean) => void;
  /** Taller scroll area for passenger (non-host) play view */
  passengerLayout?: boolean;
  /** Desktop host 2-col: compact list, flex scroll, bordered panel like mobile */
  desktopHostLayout?: boolean;
  /** When false with desktopHostLayout, search opens in modal instead of inline (e.g. guests) */
  desktopInlineSearch?: boolean;
  /** Fired when "Queue finished" (no current item but queue still has history) — for now-playing skeleton, etc. */
  onQueueFinishedIdleChange?: (finished: boolean) => void;
}

export default function Queue({
  partyId,
  currentQueueItemId,
  searchModalOpen,
  onSearchModalOpenChange,
  passengerLayout = false,
  desktopHostLayout = false,
  desktopInlineSearch = true,
  onQueueFinishedIdleChange,
}: QueueProps) {
  const isControlled = onSearchModalOpenChange != null;
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const showSearch = isControlled ? Boolean(searchModalOpen) : internalSearchOpen;

  function setShowSearch(open: boolean) {
    if (isControlled) onSearchModalOpenChange!(open);
    else setInternalSearchOpen(open);
  }

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<number, number>>({});
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingQueueItemId, setPreviewingQueueItemId] = useState<number | null>(null);
  const [previewLoadingSongId, setPreviewLoadingSongId] = useState<number | null>(null);
  /** Client cache when preview is resolved by API (older rows may lack preview_url until first tap). */
  const [previewUrlBySongId, setPreviewUrlBySongId] = useState<Record<number, string>>({});
  const [noPreviewSongIds, setNoPreviewSongIds] = useState<Set<number>>(() => new Set());
  const masterPreview = useMasterAudioPreviewOptional();

  useEffect(() => {
    const token = localStorage.getItem("sessionToken") ?? "";

    fetch(`${API_URL}/api/parties/${partyId}/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((items: QueueItem[]) => setQueue(items));

    const sock = getSocket(token);
    sock.on("queue_updated", (items: QueueItem[]) => {
      setQueue(items);
    });
    sock.on("download_progress", ({ songId, progress }: { songId: number; progress: number }) => {
      setDownloadProgress((prev) => ({ ...prev, [songId]: progress }));
      if (progress >= 100) {
        setTimeout(() => {
          setDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[songId];
            return next;
          });
        }, 1000);
      }
    });
    return () => {
      sock.off("queue_updated");
      sock.off("download_progress");
    };
  }, [partyId]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        masterPreview?.endPreview();
      }
      previewAudioRef.current = null;
    };
  }, [masterPreview]);

  async function handleQueueRowPreview(item: QueueItem) {
    const song = item.song;
    const cachedUrl = song.preview_url ?? previewUrlBySongId[song.id];

    if (previewingQueueItemId === item.id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewingQueueItemId(null);
      masterPreview?.endPreview();
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      masterPreview?.endPreview();
    }
    previewAudioRef.current = null;
    setPreviewingQueueItemId(null);

    let url = cachedUrl ?? null;
    if (!url) {
      setPreviewLoadingSongId(song.id);
      try {
        const token = localStorage.getItem("sessionToken") ?? "";
        const res = await fetch(`${API_URL}/api/parties/${partyId}/songs/${song.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { preview_url: string | null };
          if (data.preview_url) {
            url = data.preview_url;
            setPreviewUrlBySongId((prev) => ({ ...prev, [song.id]: data.preview_url! }));
          } else {
            setNoPreviewSongIds((prev) => new Set(prev).add(song.id));
          }
        }
      } finally {
        setPreviewLoadingSongId(null);
      }
    }

    if (!url) return;

    masterPreview?.beginPreview();
    const audio = new Audio(url);
    audio.onended = () => {
      setPreviewingQueueItemId(null);
      previewAudioRef.current = null;
      masterPreview?.endPreview();
    };
    previewAudioRef.current = audio;
    setPreviewingQueueItemId(item.id);
    try {
      await audio.play();
    } catch {
      setPreviewingQueueItemId(null);
      previewAudioRef.current = null;
      masterPreview?.endPreview();
    }
  }

  const currentIndex = currentQueueItemId
    ? queue.findIndex((item) => item.id === currentQueueItemId)
    : -1;
  // When nothing is playing (queue finished or idle), do not treat the whole queue as "up next".
  // Otherwise after the last track ends/skips, every previously played row looks like it's coming up again.
  const upNext =
    currentQueueItemId == null
      ? []
      : currentIndex >= 0
        ? queue.slice(currentIndex + 1)
        : [];

  /** Items before the current track (or entire queue when nothing is current but rows remain). */
  const playedPast =
    currentQueueItemId == null
      ? queue.length > 0
        ? queue
        : []
      : currentIndex > 0
        ? queue.slice(0, currentIndex)
        : [];

  const queueFinishedIdle = currentQueueItemId == null && queue.length > 0;
  const queueEmpty = queue.length === 0;

  useEffect(() => {
    onQueueFinishedIdleChange?.(queueFinishedIdle);
  }, [queueFinishedIdle, onQueueFinishedIdleChange]);

  const sectionTitle =
    upNext.length > 0
      ? "Up Next..."
      : queueFinishedIdle
        ? "Queue finished"
        : queueEmpty
          ? "Queue (0)"
          : "Nothing else queued";

  const scrollList =
    passengerLayout || desktopHostLayout ? "min-h-0 flex-1 max-h-none" : "max-h-[280px]";

  const hasListRows = upNext.length > 0 || playedPast.length > 0;

  /** Past rows: most recently played first (queue order is oldest→newest). */
  const playedPastDisplay = [...playedPast].reverse();

  function renderQueueRow(item: QueueItem, isPast: boolean) {
    const progress = downloadProgress[item.song.id];
    const isDownloading = progress !== undefined && progress < 100;
    const isFailed = item.song.download_status === "failed";
    const showOverlay = isDownloading || item.song.download_status === "pending";
    const isPreviewing = previewingQueueItemId === item.id;
    const isPreviewLoading = previewLoadingSongId === item.song.id;
    const previewKnownMissing = noPreviewSongIds.has(item.song.id);

    return (
      <li
        key={item.id}
        className={`${isPast ? "opacity-[0.15]" : ""} border-b border-app-border last:border-0`}
      >
        <button
          type="button"
          onClick={() => void handleQueueRowPreview(item)}
          disabled={isPreviewLoading}
          aria-label={`Play preview: ${item.song.song_name}`}
          className={`flex w-full items-center rounded-lg text-left transition-colors ${
            desktopHostLayout ? "gap-3 py-2.5" : "gap-3 py-3"
          } ${
            isPast
              ? ""
              : isPreviewing
                ? "bg-app-lightGreen"
                : "hover:bg-neutral-100 active:bg-neutral-200/60"
          } ${isPreviewLoading ? "opacity-70" : ""}`}
        >
          <div
            className={`relative shrink-0 overflow-hidden bg-app-surface ${desktopHostLayout ? "h-12 w-12" : "h-14 w-14"}`}
          >
            {item.song.image_path && (
              <img src={item.song.image_path} alt="" className={`h-full w-full object-cover ${isFailed ? "opacity-40" : ""}`} />
            )}
            {showOverlay && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white">
                ...
              </div>
            )}
            {isFailed && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/70 text-[10px] font-semibold text-red-200">
                Failed
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate font-medium ${isFailed ? "text-neutral-400" : ""} ${desktopHostLayout ? "text-sm" : ""}`}>
              {item.song.song_name}
            </div>
            <div
              className={`truncate ${isFailed ? "text-red-400" : "text-neutral-600"} ${desktopHostLayout ? "text-xs" : "text-sm"}`}
            >
              {isFailed ? "Download failed" : `${item.song.artist_name} · ${item.added_by_session.name}`}
            </div>
            {isPreviewLoading ? (
              <div className={`mt-0.5 text-neutral-500 ${desktopHostLayout ? "text-[11px]" : "text-xs"}`}>Loading preview…</div>
            ) : isPreviewing ? (
              <div className={`mt-0.5 text-neutral-600 ${desktopHostLayout ? "text-[11px]" : "text-xs"}`}>Playing sample…</div>
            ) : previewKnownMissing ? (
              <div className={`mt-0.5 text-neutral-400 ${desktopHostLayout ? "text-[11px]" : "text-xs"}`}>No preview available</div>
            ) : null}
          </div>
        </button>
      </li>
    );
  }

  return (
    <>
      <section
        className={`w-full transition-colors duration-300 ${
          desktopHostLayout
            ? "flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border bg-white p-4"
            : `rounded-xl border bg-app-surface p-4 ${passengerLayout ? "flex min-h-0 min-w-0 flex-1 flex-col" : ""}`
        }`}
        style={{ borderColor: previewingQueueItemId ? "#00CB5B" : "#A9A9A9" }}
      >
        {desktopHostLayout && showSearch && desktopInlineSearch ? (
          <SongSearchPanel partyId={partyId} variant="inline" onExit={() => setShowSearch(false)} />
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-neutral-900">{sectionTitle}</span>
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="shrink-0 rounded-md border-0 bg-transparent px-2 py-1 text-sm font-medium text-app-primaryGreen transition-colors hover:bg-neutral-100 active:bg-neutral-200/60"
              >
                Add Song
              </button>
            </div>

            {!hasListRows ? (
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className={`w-full text-center text-neutral-500 ${
                  desktopHostLayout
                    ? "mt-4 flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-8 text-sm leading-snug"
                    : passengerLayout
                      ? "mt-8 flex min-h-0 flex-1 flex-col items-center justify-center py-12 text-sm"
                      : "mt-8 py-8 text-sm"
                }`}
              >
                {queueFinishedIdle
                  ? "That was the last song. Add more to keep going."
                  : queueEmpty
                    ? "No songs in the queue, add one"
                    : "You're on the last song in the queue."}
              </button>
            ) : (
              <ul className={`min-w-0 space-y-0 overflow-y-auto ${scrollList} ${desktopHostLayout ? "mt-2" : "mt-3"}`}>
                {upNext.map((item) => renderQueueRow(item, false))}
                {playedPastDisplay.map((item) => renderQueueRow(item, true))}
              </ul>
            )}
          </>
        )}
      </section>

      {showSearch && (!desktopHostLayout || !desktopInlineSearch) && (
        <SearchModal partyId={partyId} onClose={() => setShowSearch(false)} />
      )}
    </>
  );
}
