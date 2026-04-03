import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMasterAudioPreviewOptional } from "../../context/MasterAudioPreviewContext";
import { usePartySettingsOptional } from "../../context/PartySettingsContext";
import { API_URL } from "../../lib/config";
import { getSocket } from "../../lib/socket";
import IconImg from "../ui/IconImg";
import CompactAudioVisualizer from "../play/CompactAudioVisualizer";
import {
  dedupeSearchResultsByTitleArtist,
  keysFromQueueItems,
  queueKeyForTrack,
  type SearchResult,
} from "./songSearchShared";

export type SongSearchPanelVariant = "modal" | "inline";

interface SongSearchPanelProps {
  partyId: string;
  variant: SongSearchPanelVariant;
  onExit?: () => void;
}

function formatLimit(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} min`;
  return `${m}m ${s}s`;
}

export default function SongSearchPanel({ partyId, variant, onExit }: SongSearchPanelProps) {
  const isInline = variant === "inline";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(() => new Set());
  const partySettingsCtx = usePartySettingsOptional();
  const limits = partySettingsCtx?.settings ?? null;
  const [addError, setAddError] = useState<{ trackId: string; message: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const masterPreview = useMasterAudioPreviewOptional();

  useLayoutEffect(() => {
    if (!isInline) return;
    searchInputRef.current?.focus();
  }, [isInline]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        masterPreview?.endPreview();
      }
      audioRef.current = null;
    };
  }, [masterPreview]);

  useEffect(() => {
    const token = localStorage.getItem("sessionToken") ?? "";

    function applyQueueItems(items: { song: { song_name: string; artist_name: string } }[]) {
      setQueuedKeys(keysFromQueueItems(items));
    }

    fetch(`${API_URL}/api/parties/${partyId}/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then(applyQueueItems);

    const sock = getSocket(token);
    sock.on("queue_updated", applyQueueItems);
    return () => {
      sock.off("queue_updated", applyQueueItems);
    };
  }, [partyId]);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);

    const res = await fetch(`${API_URL}/api/search-songs?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setResults(dedupeSearchResultsByTitleArtist(list));
    setLoading(false);
  }

  async function handleAddToQueue(e: React.MouseEvent, track: SearchResult) {
    e.stopPropagation();
    const token = localStorage.getItem("sessionToken");
    if (!token) return;

    const key = queueKeyForTrack(track.song_name, track.artist_name);
    if (queuedKeys.has(key)) return;

    setAddingId(track.spotify_id);
    try {
      const res = await fetch(`${API_URL}/api/parties/${partyId}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spotify_id: track.spotify_id,
          song_name: track.song_name,
          artist_name: track.artist_name,
          image_url: track.image_url,
          preview_url: track.preview_url,
          duration_ms: track.duration_ms,
        }),
      });
      if (res.ok) {
        setQueuedKeys((prev) => new Set(prev).add(key));
        setAddError(null);
      } else if (res.status === 409) {
        const r = await fetch(`${API_URL}/api/parties/${partyId}/queue`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const items = await r.json();
          setQueuedKeys(keysFromQueueItems(items));
        }
      } else {
        const body = await res.json().catch(() => null);
        if (body?.code === "TOO_LONG") {
          setAddError({ trackId: track.spotify_id, message: `Host set time limit to ${formatLimit(body.limit)}` });
        } else if (body?.code === "QUEUE_FULL") {
          setAddError({ trackId: track.spotify_id, message: `Queue is full (max ${body.limit} songs)` });
        } else if (body?.code === "USER_LIMIT") {
          setAddError({ trackId: track.spotify_id, message: `You can only add ${body.limit} songs` });
        }
      }
    } catch (e) {
      console.error("Add to queue failed", e);
    } finally {
      setAddingId(null);
    }
  }

  function handlePlay(track: SearchResult) {
    if (!track.preview_url) return;

    if (playingId === track.spotify_id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      masterPreview?.endPreview();
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      masterPreview?.endPreview();
    }

    masterPreview?.beginPreview();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = track.preview_url;
    audio.onended = () => {
      setPlayingId(null);
      masterPreview?.endPreview();
      audioRef.current = null;
    };
    audioRef.current = audio;
    setPlayingId(track.spotify_id);
    void audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
      masterPreview?.endPreview();
    });
  }

  const searchField = (
    <div
      className={
        isInline
          ? "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-app-border px-2 py-1.5"
          : "flex items-center gap-3 rounded-lg border border-app-border px-3 py-2"
      }
    >
      <IconImg src="/icons/search.svg" className={isInline ? "h-5 w-5 shrink-0" : "h-7 w-7 shrink-0"} />
      <input
        ref={searchInputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        placeholder="Search a song"
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-neutral-400 [appearance:textfield] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden md:text-base"
      />
    </div>
  );

  const resultRowClass = (active: boolean) =>
    isInline
      ? `flex cursor-pointer items-center gap-2 border-b border-app-border px-0 py-2 last:border-0 ${
          active ? "bg-app-surface" : ""
        }`
      : `flex cursor-pointer items-center gap-3 border-b border-app-border px-4 py-3 last:border-0 ${
          active ? "bg-app-surface" : ""
        }`;

  const thumbClass = isInline ? "h-10 w-10" : "h-14 w-14";

  const resultsBody = (
    <>
      {loading && (
        <p className={`text-center text-neutral-500 ${isInline ? "py-4 text-sm" : "px-4 py-6"}`}>Searching…</p>
      )}
      {!loading &&
        results.map((track) => {
          const key = queueKeyForTrack(track.song_name, track.artist_name);
          const isQueued = queuedKeys.has(key);
          const isAdding = addingId === track.spotify_id;
          const isPreviewPlaying = playingId === track.spotify_id;
          const isTooLong =
            limits != null &&
            limits.max_song_duration_s > 0 &&
            track.duration_ms > 0 &&
            track.duration_ms / 1000 > limits.max_song_duration_s;
          const hasError = addError?.trackId === track.spotify_id;
          return (
            <div
              key={track.spotify_id}
              onClick={() => handlePlay(track)}
              className={resultRowClass(isPreviewPlaying)}
            >
              <div className={`relative shrink-0 overflow-hidden bg-app-surface ${thumbClass}`}>
                {track.image_url && (
                  <img src={track.image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${isInline ? "text-sm" : ""}`}>{track.song_name}</div>
                <div className={`truncate text-neutral-600 ${isInline ? "text-xs" : "text-sm"}`}>
                  {track.artist_name}
                </div>
                {!track.preview_url && (
                  <div className={`text-neutral-400 ${isInline ? "text-[11px]" : "text-xs"}`}>No preview</div>
                )}
                {hasError && (
                  <div className="mt-0.5 text-[11px] font-medium text-red-500">{addError.message}</div>
                )}
              </div>
              {isPreviewPlaying && (
                <CompactAudioVisualizer audioRef={audioRef} isPlaying />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTooLong) {
                    setAddError({
                      trackId: track.spotify_id,
                      message: `Host set time limit to ${formatLimit(limits!.max_song_duration_s)}`,
                    });
                    return;
                  }
                  handleAddToQueue(e, track);
                }}
                disabled={isAdding || isQueued}
                className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-medium md:px-3 md:py-1.5 md:text-sm ${
                  isTooLong
                    ? "cursor-default border-red-300 bg-red-50 text-red-500"
                    : isQueued
                      ? "cursor-default border-app-primaryGreen bg-app-mediumGreen text-app-primaryGreen"
                      : hasError
                        ? "border-red-300 bg-red-50 text-red-500"
                        : isAdding
                          ? "border-app-primaryGreen bg-white text-app-primaryGreen opacity-70"
                          : "border-app-primaryGreen bg-white text-app-primaryGreen"
                }`}
              >
                {isAdding ? "…" : isQueued ? "Added" : isTooLong ? "Too Long" : hasError ? "Denied" : "Add"}
              </button>
            </div>
          );
        })}
    </>
  );

  if (isInline) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          {searchField}
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-md border-0 bg-transparent px-2 py-1 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 active:bg-neutral-200/60"
          >
            exit
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-0">{resultsBody}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-app-border px-6 pb-4 pt-1">{searchField}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-8">{resultsBody}</div>
    </div>
  );
}
