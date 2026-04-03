import { useCallback, useEffect, useRef, useState } from "react";
import { MasterAudioPreviewProvider, useMasterAudioPreview } from "../context/MasterAudioPreviewContext";
import { emitSocketEvent, getSocket } from "../lib/socket";
import { API_URL } from "../lib/config";
import PageShell from "./layout/PageShell";
import Queue from "./Queue";
import PlayerHeader from "./play/PlayerHeader";
import NowPlayingCard from "./play/NowPlayingCard";
import HostTransport from "./play/HostTransport";
import NowPlayingCardSkeleton from "./play/NowPlayingCardSkeleton";
import ReactionPfpRow from "./play/ReactionPfpRow";
import TripleReactionButtons from "./play/TripleReactionButtons";
import LeaderboardModal from "./play/LeaderboardModal";
import ReactionGifBurstItem from "./play/ReactionGifBurstItem";
import DesktopVisualizer from "./play/DesktopVisualizer";
import AudioRipples from "./play/AudioRipples";
import { getOrCreateGraph } from "../lib/audioGraph";
import type { Member } from "../types/member";

interface SongInfo {
  id: number;
  song_name: string;
  artist_name: string;
  image_path: string | null;
  audio_path: string | null;
  download_status: string;
}

interface QueueItemInfo {
  id: number;
  position: number;
  song: SongInfo;
  added_by_session: { name: string };
}

interface ReactionData {
  name: string;
  reaction_type: string;
  /** Present only on live socket `reaction` events — not stored in playback snapshot */
  soundUrl?: string;
  gifUrl?: string;
  gifLeftPct?: number;
  gifTopPct?: number;
}

function playReactionSound(url: string) {
  try {
    const el = new Audio(url);
    el.volume = 0.85;
    void el.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

interface PlaybackState {
  currentItem: QueueItemInfo | null;
  isPlaying: boolean;
  positionMs: number;
  reactions: ReactionData[];
}

interface PlayViewProps {
  partyId: string;
  partyName: string;
  sessionName: string;
  isHost: boolean;
  members: Member[];
  onShowGroup: () => void;
}

function PlayViewContent({
  partyId,
  partyName,
  sessionName,
  isHost,
  members,
  onShowGroup,
}: PlayViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { registerMainAudio } = useMasterAudioPreview();
  const setAudioRef = useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      registerMainAudio(el);
    },
    [registerMainAudio]
  );
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const lastSrcRef = useRef<string>("");
  const lastQueueItemIdRef = useRef<number | null>(null);
  /** Guest: anchor for extrapolating host time between playback_state events (matches server clock math). */
  const playbackSyncRef = useRef<{ positionMs: number; isPlaying: boolean; at: number }>({
    positionMs: 0,
    isPlaying: false,
    at: 0,
  });
  const [reactions, setReactions] = useState<ReactionData[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Host: track queue length for empty-queue transport (null = not loaded yet) */
  const [queueLength, setQueueLength] = useState<number | null>(null);
  /** Mirrors Queue's "Queue finished" (no current item, rows still listed) — fixes stale now-playing vs skeleton */
  const [queueFinishedIdle, setQueueFinishedIdle] = useState(false);
  const [reactionGifBursts, setReactionGifBursts] = useState<
    { id: string; gifUrl: string; gifLeftPct: number; gifTopPct: number }[]
  >([]);

  const removeGifBurst = useCallback((id: string) => {
    setReactionGifBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const myScore = members.find((m) => m.name === sessionName)?.peanut_score ?? 0;

  function syncAudio(state: PlaybackState) {
    setPlayback(state);
    if (state.reactions) setReactions(state.reactions);

    const audio = audioRef.current;
    if (!audio) return;

    const song = state.currentItem?.song;
    if (!song?.audio_path || song.download_status !== "complete") {
      audio.pause();
      return;
    }

    const src = `${API_URL}${song.audio_path}`;
    const srcChanged = lastSrcRef.current !== src;

    if (srcChanged) {
      lastSrcRef.current = src;
      audio.crossOrigin = "anonymous";
      audio.src = src;

      const onCanPlay = () => {
        audio.currentTime = Math.max(0, state.positionMs / 1000);
        if (state.isPlaying) {
          audio.play().catch(() => {});
        }
        if (!isHost) {
          playbackSyncRef.current = {
            positionMs: state.positionMs,
            isPlaying: state.isPlaying,
            at: Date.now(),
          };
        }
      };
      audio.addEventListener("canplay", onCanPlay, { once: true });
    } else {
      const targetTime = Math.max(0, state.positionMs / 1000);
      // Same track: always snap to server timeline (pause / resume / skip) so host + guests stay aligned.
      audio.currentTime = targetTime;

      if (state.isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (!isHost && !srcChanged) {
      playbackSyncRef.current = {
        positionMs: state.positionMs,
        isPlaying: state.isPlaying,
        at: Date.now(),
      };
    }

    lastQueueItemIdRef.current = state.currentItem?.id ?? null;
  }

  useEffect(() => {
    const token = localStorage.getItem("sessionToken") ?? "";

    fetch(`${API_URL}/api/parties/${partyId}/playback`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((state) => {
        if (state) syncAudio(state);
      });

    const sock = getSocket(token);
    if (!sock.connected) sock.connect();

    sock.on("playback_state", (state: PlaybackState) => {
      syncAudio(state);
    });
    sock.on("reaction", (r: ReactionData) => {
      if (r.soundUrl) playReactionSound(r.soundUrl);
      if (r.gifUrl != null && r.gifLeftPct != null && r.gifTopPct != null) {
        const gifUrl = r.gifUrl;
        const gifLeftPct = r.gifLeftPct;
        const gifTopPct = r.gifTopPct;
        const id =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        setReactionGifBursts((prev) => [...prev, { id, gifUrl, gifLeftPct, gifTopPct }]);
      }
      setReactions((prev) => [...prev, { name: r.name, reaction_type: r.reaction_type }]);
    });
    sock.on("reaction_removed", (r: ReactionData) => {
      setReactions((prev) => {
        const idx = prev.findIndex((x) => x.name === r.name && x.reaction_type === r.reaction_type);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    });

    return () => {
      sock.off("playback_state");
      sock.off("reaction");
      sock.off("reaction_removed");
    };
  }, [partyId]);

  useEffect(() => {
    if (!isHost) return;
    const token = localStorage.getItem("sessionToken") ?? "";

    fetch(`${API_URL}/api/parties/${partyId}/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((items: unknown[]) => setQueueLength(Array.isArray(items) ? items.length : 0));

    const sock = getSocket(token);
    const onQueueUpdated = (items: unknown[]) => {
      setQueueLength(Array.isArray(items) ? items.length : 0);
    };
    sock.on("queue_updated", onQueueUpdated);
    return () => {
      sock.off("queue_updated", onQueueUpdated);
    };
  }, [partyId, isHost]);

  // Guests: correct drift vs extrapolated host position between socket updates.
  useEffect(() => {
    if (isHost) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      const sync = playbackSyncRef.current;
      if (!audio || !sync.isPlaying || audio.readyState < 2) return;
      const elapsed = Date.now() - sync.at;
      const targetSec = (sync.positionMs + elapsed) / 1000;
      if (!Number.isFinite(targetSec) || targetSec < 0) return;
      if (Math.abs(audio.currentTime - targetSec) > 0.5) {
        audio.currentTime = targetSec;
      }
    }, 400);
    return () => clearInterval(id);
  }, [isHost]);

  function emitHostControl(action: string) {
    new Audio("/NextBackPlayPause.mp3").play().catch(() => {});
    emitSocketEvent(action);
  }

  function handleSongEnded() {
    const queueItemId = playback?.currentItem?.id;
    emitSocketEvent("song_ended", queueItemId ? { queueItemId } : undefined);
  }

  async function handleReaction(reactionType: "Claps" | "Shit") {
    const token = localStorage.getItem("sessionToken");
    if (!token) return;
    await fetch(`${API_URL}/api/parties/${partyId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reactionType }),
    });
  }

  const currentSong = playback?.currentItem?.song;
  const addedBy = playback?.currentItem?.added_by_session?.name;
  const isPlaying = playback?.isPlaying ?? false;
  const downloadFailed = currentSong?.download_status === "failed";
  const waitingForDownload = isPlaying && currentSong && currentSong.download_status !== "complete" && !downloadFailed;
  /** Prefer skeleton when queue UI says finished, even if playback lags clearing currentItem */
  const showNowPlayingSkeleton = !currentSong || queueFinishedIdle;
  /** Empty queue or finished last track (no current item) — show add-music center control */
  const showAddMusicCenter = queueLength !== null && (!currentSong || queueFinishedIdle);

  const queueProps = {
    partyId,
    currentQueueItemId: playback?.currentItem?.id ?? null,
    searchModalOpen: searchOpen,
    onSearchModalOpenChange: setSearchOpen,
    onQueueFinishedIdleChange: setQueueFinishedIdle,
  };

  const myReactionType = reactions.find((r) => r.name === sessionName)?.reaction_type;
  const activeReaction: "Claps" | "Shit" | null =
    myReactionType === "Claps" || myReactionType === "Shit" ? myReactionType : null;

  const reactionButtonProps = {
    idle: !currentSong || queueFinishedIdle,
    activeReaction,
    onClap: () => handleReaction("Claps"),
    onShit: () => handleReaction("Shit"),
    onLeaderboard: () => setShowLeaderboard(true),
  };

  const [borderColor, setBorderColor] = useState("#A9A9A9");
  const borderRafRef = useRef<number>(0);

  useEffect(() => {
    const GREY = [169, 169, 169];
    const GREEN = [0, 203, 91];

    const loop = () => {
      borderRafRef.current = requestAnimationFrame(loop);
      const audio = audioRef.current;
      if (!audio || !isPlaying) {
        setBorderColor("#A9A9A9");
        return;
      }
      const graph = getOrCreateGraph(audio);
      if (!graph) { setBorderColor("#A9A9A9"); return; }
      const { ctx, analyser } = graph;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const energy = Math.min(1, (sum / data.length / 255) * 1.8);
      const r = Math.round(GREY[0] + (GREEN[0] - GREY[0]) * energy);
      const g = Math.round(GREY[1] + (GREEN[1] - GREY[1]) * energy);
      const b = Math.round(GREY[2] + (GREEN[2] - GREY[2]) * energy);
      setBorderColor(`rgb(${r},${g},${b})`);
    };
    borderRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(borderRafRef.current);
  }, [isPlaying]);

  return (
    <>
    <AudioRipples audioRef={audioRef} isPlaying={isPlaying} />
    <PageShell className={isHost ? "pb-8 md:pb-28" : "pb-0 md:pb-28"} cardBorderColor={borderColor}>
      <div className="shrink-0 md:hidden">
        <PlayerHeader
          partyName={partyName}
          peanutScore={myScore}
          onOpenGroup={onShowGroup}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      </div>

      <audio ref={setAudioRef} onEnded={handleSongEnded} className="hidden" />

      {isHost ? (
        <>
          {/* Mobile host — single column */}
          <div className="flex min-h-0 flex-1 flex-col md:hidden">
            {!showNowPlayingSkeleton && currentSong ? (
              <div className={reactions.length > 0 ? "mt-3" : "mt-6"}>
                <ReactionPfpRow reactions={reactions} />
                <div className={reactions.length > 0 ? "mt-4" : undefined}>
                  <NowPlayingCard
                    imageUrl={currentSong.image_path}
                    songName={currentSong.song_name}
                    artistName={currentSong.artist_name}
                    addedBy={addedBy ?? null}
                    waitingForDownload={Boolean(waitingForDownload)}
                    downloadFailed={downloadFailed}
                    compact={false}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <NowPlayingCardSkeleton />
              </div>
            )}

            <div className="mt-2">
              <HostTransport
                tight
                idle={!currentSong || queueFinishedIdle}
                showAddMusicCenter={showAddMusicCenter}
                onAddSong={() => setSearchOpen(true)}
                isPlaying={isPlaying}
                onPrev={() => emitHostControl("host_prev")}
                onPlayPause={() => emitHostControl(isPlaying ? "host_pause" : "host_play")}
                onNext={() => emitHostControl("host_skip")}
              />
            </div>

            <div className="mt-2">
              <TripleReactionButtons {...reactionButtonProps} hostMobile />
            </div>

            <div className="mt-8 min-h-0 flex-1">
              <Queue {...queueProps} />
            </div>
          </div>

          {/* Desktop host — 2-col flex inside same 430px card */}
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <div className="flex min-h-0 flex-1 flex-row">
              <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                  <div className="my-auto flex w-full min-w-0 flex-col items-center gap-2 px-3 py-2">
                    <ReactionPfpRow
                      avatarSize={28}
                      reactionBadgePx={16}
                      justify="center"
                      reactions={reactions}
                    />
                    <div className="w-full">
                      {!showNowPlayingSkeleton && currentSong ? (
                        <NowPlayingCard
                          imageUrl={currentSong.image_path}
                          songName={currentSong.song_name}
                          artistName={currentSong.artist_name}
                          addedBy={addedBy ?? null}
                          waitingForDownload={Boolean(waitingForDownload)}
                          downloadFailed={downloadFailed}
                          desktopHost
                        />
                      ) : (
                        <NowPlayingCardSkeleton desktopHost />
                      )}
                    </div>
                    <div className="w-full shrink-0">
                      <HostTransport
                        compact
                        idle={!currentSong || queueFinishedIdle}
                        showAddMusicCenter={showAddMusicCenter}
                        onAddSong={() => setSearchOpen(true)}
                        isPlaying={isPlaying}
                        onPrev={() => emitHostControl("host_prev")}
                        onPlayPause={() => emitHostControl(isPlaying ? "host_pause" : "host_play")}
                        onNext={() => emitHostControl("host_skip")}
                      />
                    </div>
                    <div className="w-full shrink-0">
                      <TripleReactionButtons {...reactionButtonProps} compact />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
                <Queue {...queueProps} desktopHostLayout />
                <PlayerHeader
                  variant="footer"
                  partyName={partyName}
                  peanutScore={myScore}
                  onOpenGroup={onShowGroup}
                  onOpenLeaderboard={() => setShowLeaderboard(true)}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile passenger */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
            <Queue {...queueProps} passengerLayout />

            {!showNowPlayingSkeleton && currentSong ? (
              <div className="mt-6 shrink-0">
                {reactions.length > 0 && (
                  <div className="mb-2">
                    <ReactionPfpRow reactions={reactions} />
                  </div>
                )}
                <NowPlayingCard
                  imageUrl={currentSong.image_path}
                  songName={currentSong.song_name}
                  artistName={currentSong.artist_name}
                  addedBy={addedBy ?? null}
                  waitingForDownload={Boolean(waitingForDownload)}
                  downloadFailed={downloadFailed}
                  compact
                  audioRef={audioRef}
                  isPlaying={isPlaying}
                />
              </div>
            ) : (
              <div className="mt-6 shrink-0">
                <NowPlayingCardSkeleton compact />
              </div>
            )}

            <div className="mt-6 mb-4 shrink-0">
              <TripleReactionButtons {...reactionButtonProps} />
            </div>
          </div>

          {/* Desktop passenger — 2-col like host, no transport; search stays modal */}
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <div className="flex min-h-0 flex-1 flex-row">
              <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                  <div className="my-auto flex w-full min-w-0 flex-col items-center gap-2 px-3 py-2">
                    <ReactionPfpRow
                      avatarSize={28}
                      reactionBadgePx={16}
                      justify="center"
                      reactions={reactions}
                    />
                    <div className="w-full">
                      {!showNowPlayingSkeleton && currentSong ? (
                        <NowPlayingCard
                          imageUrl={currentSong.image_path}
                          songName={currentSong.song_name}
                          artistName={currentSong.artist_name}
                          addedBy={addedBy ?? null}
                          waitingForDownload={Boolean(waitingForDownload)}
                          downloadFailed={downloadFailed}
                          desktopHost
                        />
                      ) : (
                        <NowPlayingCardSkeleton desktopHost />
                      )}
                    </div>
                    <div className="w-full shrink-0">
                      <TripleReactionButtons {...reactionButtonProps} passengerDesktop />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 w-1/2 flex-col overflow-hidden">
                <Queue {...queueProps} desktopHostLayout />
                <PlayerHeader
                  variant="footer"
                  partyName={partyName}
                  peanutScore={myScore}
                  onOpenGroup={onShowGroup}
                  onOpenLeaderboard={() => setShowLeaderboard(true)}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {showLeaderboard && (
        <LeaderboardModal partyId={partyId} members={members} onClose={() => setShowLeaderboard(false)} />
      )}
    </PageShell>
    <div className="pointer-events-none fixed inset-x-0 bottom-0 hidden h-[140px] md:block" aria-hidden>
      <DesktopVisualizer audioRef={audioRef} isPlaying={isPlaying} />
    </div>
    {reactionGifBursts.length > 0 && (
      <div
        className="pointer-events-none fixed inset-0 z-[1100] h-[100dvh] w-[100vw] overflow-hidden"
        aria-hidden
      >
        {reactionGifBursts.map((b) => (
          <ReactionGifBurstItem
            key={b.id}
            burstId={b.id}
            gifUrl={b.gifUrl}
            leftPct={b.gifLeftPct}
            topPct={b.gifTopPct}
            onDismiss={removeGifBurst}
          />
        ))}
      </div>
    )}
    </>
  );
}

export default function PlayView(props: PlayViewProps) {
  return (
    <MasterAudioPreviewProvider>
      <PlayViewContent {...props} />
    </MasterAudioPreviewProvider>
  );
}
