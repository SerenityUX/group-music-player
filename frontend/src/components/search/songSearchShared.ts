/** Matches backend song lookup (song_name + artist_name). */
export function queueKeyForTrack(songName: string, artistName: string) {
  return `${songName}\0${artistName}`;
}

export function keysFromQueueItems(items: { song: { song_name: string; artist_name: string } }[]) {
  const next = new Set<string>();
  for (const it of items) {
    next.add(queueKeyForTrack(it.song.song_name, it.song.artist_name));
  }
  return next;
}

export interface SearchResult {
  spotify_id: string;
  song_name: string;
  artist_name: string;
  image_url: string | null;
  preview_url: string | null;
  duration_ms: number;
}

/** Spotify often returns duplicates (e.g. album vs single); keep first row per title + artist. */
export function dedupeSearchResultsByTitleArtist(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const track of results) {
    const key = queueKeyForTrack(track.song_name, track.artist_name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}
