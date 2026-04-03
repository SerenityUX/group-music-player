import { useEffect, useState } from "react";
import Pfp from "../Pfp";
import IconImg from "../ui/IconImg";
import type { Member } from "../../types/member";
import { API_URL } from "../../lib/config";

interface SongScore {
  id: number;
  song_name: string;
  artist_name: string;
  image_path: string | null;
  added_by: string;
  added_by_id: number;
  likes: number;
  shits: number;
}

interface LeaderboardModalProps {
  partyId: string;
  members: Member[];
  onClose: () => void;
}

export default function LeaderboardModal({ partyId, members, onClose }: LeaderboardModalProps) {
  const [songs, setSongs] = useState<SongScore[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("sessionToken") ?? "";
    fetch(`${API_URL}/api/parties/${partyId}/song-leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SongScore[]) => setSongs(data));
  }, [partyId]);

  const sorted = [...members].sort((a, b) => b.peanut_score - a.peanut_score);

  const songsByMember = (memberId: number) =>
    songs.filter((s) => s.added_by_id === memberId);

  const peopleList = (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">People</h3>
      {sorted.map((m, i) => {
        const memberSongs = songsByMember(m.id);
        const isWinner = i === 0;
        return (
          <div
            key={m.id}
            className="rounded-lg border-b border-app-border py-3 last:border-0"
            style={isWinner ? { backgroundColor: "#EAF9EE" } : undefined}
          >
            <div className="flex items-center gap-3 px-2">
              <span className="w-6 text-sm text-neutral-500">{i + 1}.</span>
              <Pfp name={m.name} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              {isWinner && <IconImg src="/icons/crown.svg" className="h-4 w-4 shrink-0" />}
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                <IconImg src="/icons/peanut.svg" className="h-4 w-4" />
                {m.peanut_score}
              </span>
            </div>
            {memberSongs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                {memberSongs.map((s) => {
                  const net = (s.likes - s.shits) * 10;
                  return (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full bg-app-surface px-2.5 py-1 text-xs text-neutral-600"
                    >
                      {s.image_path && (
                        <img src={s.image_path} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                      )}
                      <span className="max-w-[100px] truncate">{s.song_name}</span>
                      <span className={`font-semibold tabular-nums ${net > 0 ? "text-app-primaryGreen" : net < 0 ? "text-red-500" : "text-neutral-400"}`}>
                        {net > 0 ? `+${net}` : net}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-400">No members yet</p>
      )}
    </div>
  );

  const songList = (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Songs</h3>
      {songs.map((s, i) => {
        const isWinner = i === 0;
        return (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-lg px-2 py-3"
            style={isWinner ? { backgroundColor: "#EAF9EE" } : undefined}
          >
            <span className="w-6 text-sm text-neutral-500">{i + 1}.</span>
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-app-surface">
              {s.image_path && <img src={s.image_path} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                <span className="truncate">{s.song_name}</span>
                {isWinner && <IconImg src="/icons/crown.svg" className="h-3.5 w-3.5 shrink-0" />}
              </div>
              <div className="truncate text-xs text-neutral-500">{s.artist_name} · {s.added_by}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums">
              <span className="flex items-center gap-0.5 font-semibold">
                <IconImg src="/icons/clap.svg" className="h-3.5 w-3.5" />
                {s.likes}
              </span>
              <span className="flex items-center gap-0.5 font-semibold">
                <IconImg src="/icons/shit.svg" className="h-3.5 w-3.5" />
                {s.shits}
              </span>
            </div>
          </div>
        );
      })}
      {songs.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-400">No songs played yet</p>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[1000] overflow-y-auto bg-white text-neutral-900 md:bg-app-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[500px] flex-col px-4 pt-4 pb-8 md:max-w-none md:w-full md:justify-center md:px-4 md:pb-28 md:pt-0">
        <div className="flex flex-1 flex-col md:min-h-0 md:items-center md:justify-center md:py-4">
          <div className="relative z-10 flex w-full flex-1 flex-col md:max-h-[430px] md:min-h-[430px] md:max-w-[600px] md:overflow-hidden md:rounded-[12px] md:border md:border-app-border md:bg-white">
            <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-0 md:overflow-y-auto md:px-4 md:pb-4 md:pt-0">
              <div className="flex flex-1 flex-col max-md:min-h-full md:min-h-full">
                {/* Mobile header */}
                <header className="mb-4 flex items-center justify-between md:hidden">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 hover:bg-app-surface"
                    aria-label="Close"
                  >
                    <IconImg src="/icons/icon-close.svg" className="h-6 w-6" />
                  </button>
                  <h1 className="flex-1 text-center text-lg font-semibold">Leaderboard</h1>
                  <div className="w-10" />
                </header>

                {/* Desktop header */}
                <div className="relative hidden shrink-0 items-center justify-between border-b border-app-border py-4 md:flex">
                  <div className="z-10 flex w-10 shrink-0 justify-start">
                    <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-app-surface" aria-label="Close">
                      <IconImg src="/icons/icon-close.svg" className="h-6 w-6" />
                    </button>
                  </div>
                  <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-semibold text-neutral-900">
                    Leaderboard
                  </h1>
                  <div className="w-10" />
                </div>

                {/* Mobile: single scrollable column with both lists */}
                <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto md:hidden">
                  {peopleList}
                  <div className="mt-6">{songList}</div>
                </div>

                {/* Desktop: two columns side by side */}
                <div className="hidden min-h-0 flex-1 flex-row md:flex">
                  <div className="flex min-h-0 w-1/2 flex-col overflow-y-auto border-r border-app-border p-4">
                    {peopleList}
                  </div>
                  <div className="flex min-h-0 w-1/2 flex-col overflow-y-auto p-4">
                    {songList}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
