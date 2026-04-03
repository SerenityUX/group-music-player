import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { execFile } from "child_process";

import { env } from "./env.js";

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);
const DOWNLOADS_DIR = path.resolve(__dirname, "../downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

/** Public reaction SFX (mirrors `frontend/public/sounds/{good,bad}`). */
const REACTION_SOUNDS_GOOD = path.resolve(__dirname, "../../frontend/public/sounds/good");
const REACTION_SOUNDS_BAD = path.resolve(__dirname, "../../frontend/public/sounds/bad");

function pickRandomReactionSoundUrl(reactionType: "Claps" | "Shit"): string | null {
  const dir = reactionType === "Claps" ? REACTION_SOUNDS_GOOD : REACTION_SOUNDS_BAD;
  const sub = reactionType === "Claps" ? "good" : "bad";
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f));
    if (files.length === 0) return null;
    const file = files[Math.floor(Math.random() * files.length)]!;
    return `/sounds/${sub}/${encodeURIComponent(file)}`;
  } catch {
    return null;
  }
}

/** Public reaction GIFs (mirrors `frontend/public/gif/{good,bad}`). */
const REACTION_GIFS_GOOD = path.resolve(__dirname, "../../frontend/public/gif/good");
const REACTION_GIFS_BAD = path.resolve(__dirname, "../../frontend/public/gif/bad");

function pickRandomReactionGifUrl(reactionType: "Claps" | "Shit"): string | null {
  const dir = reactionType === "Claps" ? REACTION_GIFS_GOOD : REACTION_GIFS_BAD;
  const sub = reactionType === "Claps" ? "good" : "bad";
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => /\.gif$/i.test(f));
    if (files.length === 0) return null;
    const file = files[Math.floor(Math.random() * files.length)]!;
    return `/gif/${sub}/${encodeURIComponent(file)}`;
  } catch {
    return null;
  }
}

/** Same % position for every client; center of GIF anchored here. */
function randomReactionGifPosition(): { gifLeftPct: number; gifTopPct: number } {
  return {
    gifLeftPct: 8 + Math.random() * 84,
    gifTopPct: 8 + Math.random() * 78,
  };
}

/** Stable mp3 name from title+artist so auto-increment song ids reusing after a DB reset never play another track's file. */
function audioFileBaseName(songName: string, artistName: string): string {
  const identity = `${songName.trim()}\0${artistName.trim()}`;
  const h = crypto.createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 20);
  return `song-${h}`;
}

function removeFileIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Removed existing file before download: ${path.basename(filePath)}`);
    }
  } catch (e) {
    console.warn(`Could not remove ${filePath}:`, e);
  }
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use("/downloads", express.static(DOWNLOADS_DIR));

// BigInt can't be JSON.stringify'd by default
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? Number(value) : value
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json() as { access_token: string; expires_in: number };
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + data.expires_in * 1000 - 60_000;
  return spotifyToken;
}

app.get("/api/search-songs", async (req, res) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "q query param required" });
    return;
  }

  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/search?${new URLSearchParams({ q, type: "track", limit: "10" })}`;

  const spotifyRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await spotifyRes.json() as any;

  const tracks = data.tracks?.items ?? [];

  const results = await Promise.all(
    tracks.map(async (track: any) => {
      let previewUrl = track.preview_url ?? null;

      if (!previewUrl) {
        previewUrl = await scrapePreviewUrl(track.id);
      }

      return {
        spotify_id: track.id,
        song_name: track.name,
        artist_name: track.artists.map((a: any) => a.name).join(", "),
        image_url: track.album.images?.[0]?.url ?? null,
        preview_url: previewUrl,
        duration_ms: track.duration_ms,
      };
    })
  );

  res.json(results);
});

app.get("/api/parties/:partyId/queue", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!authToken) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });

  if (!session) {
    res.status(403).json({ error: "Not in this party" });
    return;
  }

  const items = await prisma.queueItem.findMany({
    where: { party_id: partyId },
    orderBy: { position: "asc" },
    include: { song: true, added_by_session: { select: { name: true } } },
  });

  res.json(serializeBigInts(items));
});

app.get("/api/parties/:partyId/songs/:songId/preview", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId, songId: songIdParam } = req.params;
  const songId = parseInt(songIdParam, 10);
  if (!Number.isFinite(songId)) {
    res.status(400).json({ error: "Invalid song id" });
    return;
  }
  if (!authToken) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });
  if (!session) {
    res.status(403).json({ error: "Not in this party" });
    return;
  }

  const inQueue = await prisma.queueItem.findFirst({
    where: { party_id: partyId, song_id: songId },
  });
  if (!inQueue) {
    res.status(404).json({ error: "Song not in queue" });
    return;
  }

  const previewUrl = await ensureSongPreviewUrl(songId);
  res.json({ preview_url: previewUrl });
});

app.post("/api/parties/:partyId/queue", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;
  const { spotify_id, song_name, artist_name, image_url, preview_url, duration_ms } = req.body;

  if (!authToken) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });

  if (!session) {
    res.status(403).json({ error: "Not in this party" });
    return;
  }

  const partySettings = await prisma.party.findUnique({
    where: { id: partyId },
    select: { max_song_duration_s: true, max_queue_size: true, max_songs_per_user: true },
  });

  if (partySettings && duration_ms) {
    const durationS = duration_ms / 1000;
    if (partySettings.max_song_duration_s > 0 && durationS > partySettings.max_song_duration_s) {
      res.status(400).json({
        error: "Song too long",
        code: "TOO_LONG",
        limit: partySettings.max_song_duration_s,
      });
      return;
    }
  }

  if (partySettings && partySettings.max_queue_size > 0) {
    const queueCount = await prisma.queueItem.count({ where: { party_id: partyId } });
    if (queueCount >= partySettings.max_queue_size) {
      res.status(400).json({
        error: "Queue is full",
        code: "QUEUE_FULL",
        limit: partySettings.max_queue_size,
      });
      return;
    }
  }

  if (partySettings && partySettings.max_songs_per_user > 0) {
    const userCount = await prisma.queueItem.count({
      where: { party_id: partyId, added_by: session.id },
    });
    if (userCount >= partySettings.max_songs_per_user) {
      res.status(400).json({
        error: "You've reached the song limit",
        code: "USER_LIMIT",
        limit: partySettings.max_songs_per_user,
      });
      return;
    }
  }

  const now = BigInt(Date.now());

  const lastItem = await prisma.queueItem.findFirst({
    where: { party_id: partyId },
    orderBy: { position: "desc" },
  });
  const nextPosition = (lastItem?.position ?? -1) + 1;

  let song = await prisma.song.findFirst({
    where: { song_name, artist_name },
  });

  if (!song) {
    song = await prisma.song.create({
      data: {
        audio_path: null,
        image_path: image_url,
        preview_url: preview_url ?? null,
        song_name,
        artist_name,
        download_status: "pending",
        song_length: duration_ms ? duration_ms / 1000 : null,
        created_at: now,
      },
    });
  } else if (preview_url && !song.preview_url) {
    song = await prisma.song.update({
      where: { id: song.id },
      data: { preview_url },
    });
  }

  const alreadyInQueue = await prisma.queueItem.findFirst({
    where: { party_id: partyId, song_id: song.id },
  });
  if (alreadyInQueue) {
    res.status(409).json({ error: "Already in queue" });
    return;
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { current_queue_item_id: true },
  });
  const shouldAutoStartPlayback = !party?.current_queue_item_id;

  const queueItem = await prisma.queueItem.create({
    data: {
      party_id: partyId,
      song_id: song.id,
      position: nextPosition,
      added_by: session.id,
      created_at: now,
    },
    include: { song: true, added_by_session: { select: { name: true } } },
  });

  if (shouldAutoStartPlayback) {
    const songReady = song.download_status === "complete" && Boolean(song.audio_path);
    if (songReady) {
      partyPlayback.set(partyId, Date.now());
      pendingPlay.delete(partyId);
    } else {
      partyPlayback.delete(partyId);
      pendingPlay.add(partyId);
    }
    await prisma.party.update({
      where: { id: partyId },
      data: {
        current_queue_item_id: queueItem.id,
        playback_position_ms: 0,
        is_paused: 0,
      },
    });
    await broadcastPlaybackState(partyId);
  }

  res.json(serializeBigInts(queueItem));

  await broadcastQueue(partyId);

  if (song.download_status === "pending") {
    downloadSong(song.id, song_name, artist_name, spotify_id, partyId);
  }
});

app.post("/api/parties/:partyId/react", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;
  const { reactionType } = req.body;

  if (!authToken) { res.status(401).json({ error: "No token" }); return; }

  if (!["Claps", "Shit"].includes(reactionType)) {
    res.status(400).json({ error: "Invalid reaction type" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party?.current_queue_item_id) {
    res.status(400).json({ error: "No song playing" });
    return;
  }

  const existing = await prisma.reaction.findFirst({
    where: {
      reacted_by: session.id,
      queue_item_id: party.current_queue_item_id,
    },
  });

  if (existing && existing.reaction_type === reactionType) {
    await prisma.reaction.delete({ where: { id: existing.id } });

    const countField = reactionType === "Claps" ? "likes_count" : "shits_count";
    await prisma.queueItem.update({
      where: { id: party.current_queue_item_id },
      data: { [countField]: { decrement: 1 } },
    });

    const queueItem = await prisma.queueItem.findUnique({ where: { id: party.current_queue_item_id } });
    const scoreDelta = reactionType === "Claps" ? -10 : 10;
    if (queueItem) {
      await prisma.session.update({
        where: { id: queueItem.added_by },
        data: { peanut_score: { increment: scoreDelta } },
      });
    }

    res.json({ ok: true, removed: true });
    io.to(partyId).emit("reaction_removed", { name: session.name, reaction_type: reactionType });
    await broadcastMembers(partyId);
    return;
  }

  if (existing) {
    const oldCountField = existing.reaction_type === "Claps" ? "likes_count" : "shits_count";
    await prisma.reaction.delete({ where: { id: existing.id } });
    await prisma.queueItem.update({
      where: { id: party.current_queue_item_id },
      data: { [oldCountField]: { decrement: 1 } },
    });

    const oldScoreDelta = existing.reaction_type === "Claps" ? -10 : 10;
    const queueItemForSwap = await prisma.queueItem.findUnique({ where: { id: party.current_queue_item_id } });
    if (queueItemForSwap) {
      await prisma.session.update({
        where: { id: queueItemForSwap.added_by },
        data: { peanut_score: { increment: oldScoreDelta } },
      });
    }

    io.to(partyId).emit("reaction_removed", { name: session.name, reaction_type: existing.reaction_type });
  }

  const now = BigInt(Date.now());

  await prisma.reaction.create({
    data: {
      reaction_type: reactionType,
      reacted_by: session.id,
      queue_item_id: party.current_queue_item_id,
      created_at: now,
    },
  });

  const countField = reactionType === "Claps" ? "likes_count" : "shits_count";
  await prisma.queueItem.update({
    where: { id: party.current_queue_item_id },
    data: { [countField]: { increment: 1 } },
  });

  const queueItem = await prisma.queueItem.findUnique({
    where: { id: party.current_queue_item_id },
  });

  const scoreDelta = reactionType === "Claps" ? 10 : -10;
  if (queueItem) {
    await prisma.session.update({
      where: { id: queueItem.added_by },
      data: { peanut_score: { increment: scoreDelta } },
    });
  }

  res.json({ ok: true });

  const soundUrl = pickRandomReactionSoundUrl(reactionType);
  const gifUrl = pickRandomReactionGifUrl(reactionType);
  const gifPos = gifUrl ? randomReactionGifPosition() : null;
  io.to(partyId).emit("reaction", {
    name: session.name,
    reaction_type: reactionType,
    ...(soundUrl ? { soundUrl } : {}),
    ...(gifUrl && gifPos
      ? { gifUrl, gifLeftPct: gifPos.gifLeftPct, gifTopPct: gifPos.gifTopPct }
      : {}),
  });
  await broadcastMembers(partyId);
});

app.get("/api/parties/:partyId/leaderboard", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!authToken) { res.status(401).json({ error: "No token" }); return; }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }

  const sessions = await prisma.session.findMany({
    where: { party_id: partyId },
    select: { name: true, peanut_score: true },
    orderBy: { peanut_score: "desc" },
  });

  res.json(sessions);
});

app.get("/api/parties/:partyId/song-leaderboard", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!authToken) { res.status(401).json({ error: "No token" }); return; }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }

  const items = await prisma.queueItem.findMany({
    where: { party_id: partyId },
    include: {
      song: { select: { song_name: true, artist_name: true, image_path: true } },
      added_by_session: { select: { name: true } },
    },
    orderBy: { position: "asc" },
  });

  const songs = items
    .map((item) => ({
      id: item.id,
      song_name: item.song.song_name,
      artist_name: item.song.artist_name,
      image_path: item.song.image_path,
      added_by: item.added_by_session.name,
      added_by_id: item.added_by,
      likes: item.likes_count,
      shits: item.shits_count,
    }))
    .sort((a, b) => (b.likes - b.shits) - (a.likes - a.shits));

  res.json(songs);
});

app.get("/api/parties/:partyId/settings", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;
  if (!authToken) { res.status(401).json({ error: "No token" }); return; }
  const session = await prisma.session.findFirst({ where: { token: authToken, party_id: partyId } });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { max_song_duration_s: true, max_queue_size: true, max_songs_per_user: true },
  });
  if (!party) { res.status(404).json({ error: "Party not found" }); return; }

  res.json(party);
});

app.put("/api/parties/:partyId/settings", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;
  if (!authToken) { res.status(401).json({ error: "No token" }); return; }

  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { host_id: true } });
  if (!party) { res.status(404).json({ error: "Party not found" }); return; }

  const session = await prisma.session.findFirst({ where: { token: authToken, party_id: partyId } });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }
  if (session.id !== party.host_id) { res.status(403).json({ error: "Only the host can change settings" }); return; }

  const { max_song_duration_s, max_queue_size, max_songs_per_user } = req.body;
  const data: Record<string, number> = {};
  if (typeof max_song_duration_s === "number") data.max_song_duration_s = max_song_duration_s;
  if (typeof max_queue_size === "number") data.max_queue_size = max_queue_size;
  if (typeof max_songs_per_user === "number") data.max_songs_per_user = max_songs_per_user;

  const updated = await prisma.party.update({ where: { id: partyId }, data });
  res.json({
    max_song_duration_s: updated.max_song_duration_s,
    max_queue_size: updated.max_queue_size,
    max_songs_per_user: updated.max_songs_per_user,
  });
});

async function downloadSong(songId: number, songName: string, artistName: string, _spotifyId: string, partyId: string) {
  io.to(partyId).emit("download_progress", { songId, progress: 5 });

  const searchQuery = `${songName} ${artistName}`;
  const baseName = audioFileBaseName(songName, artistName);
  const filename = `${baseName}.mp3`;
  const filePath = path.join(DOWNLOADS_DIR, filename);

  console.log(`Downloading "${songName}" by ${artistName} via yt-dlp...`);

  try {
    io.to(partyId).emit("download_progress", { songId, progress: 15 });

    removeFileIfExists(filePath);

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", path.join(DOWNLOADS_DIR, `${baseName}.%(ext)s`),
        "--no-progress",
        "--no-playlist",
        `ytsearch1:${searchQuery}`,
      ];

      console.log(`yt-dlp args: ${JSON.stringify(args)}`);

      const proc = execFile("yt-dlp", args, { timeout: 120_000 }, (err, stdout, stderr) => {
        if (err) {
          console.error(`yt-dlp failed for song ${songId}:`, err.message);
          console.error("yt-dlp stderr:", stderr);
          console.error("yt-dlp stdout:", stdout);
          reject(err);
        } else {
          console.log(`yt-dlp stdout for song ${songId}:`, stdout.slice(0, 200));
          resolve();
        }
      });

      proc.on("spawn", () => {
        io.to(partyId).emit("download_progress", { songId, progress: 40 });
      });

      proc.on("error", (err) => {
        console.error(`Failed to spawn yt-dlp for song ${songId}:`, err.message);
      });
    });

    if (!fs.existsSync(filePath)) {
      throw new Error("yt-dlp finished but output file not found");
    }

    io.to(partyId).emit("download_progress", { songId, progress: 90 });

    await prisma.song.update({
      where: { id: songId },
      data: {
        audio_path: `/downloads/${filename}`,
        download_status: "complete",
      },
    });

    console.log(`Download complete: ${filename}`);

    if (pendingPlay.has(partyId)) {
      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (party?.current_queue_item_id) {
        const currentItem = await prisma.queueItem.findUnique({
          where: { id: party.current_queue_item_id },
        });
        if (currentItem?.song_id === songId) {
          pendingPlay.delete(partyId);
          partyPlayback.set(partyId, Date.now());
          await broadcastPlaybackState(partyId);
        }
      }
    }
  } catch (err) {
    console.error("Download failed:", err);
    await prisma.song.update({
      where: { id: songId },
      data: { download_status: "failed" },
    });
  }

  io.to(partyId).emit("download_progress", { songId, progress: 100 });
  await broadcastQueue(partyId);
}

function serializeBigInts(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? Number(value) : value
  ));
}

async function broadcastQueue(partyId: string) {
  const items = await prisma.queueItem.findMany({
    where: { party_id: partyId },
    orderBy: { position: "asc" },
    include: { song: true, added_by_session: { select: { name: true } } },
  });
  io.to(partyId).emit("queue_updated", serializeBigInts(items));
}

// --- Playback sync (in-memory, resets on server restart) ---
const partyPlayback = new Map<string, number>();
const pendingPlay = new Set<string>();

async function getPlaybackState(partyId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;

  let currentItem = null;
  if (party.current_queue_item_id) {
    currentItem = await prisma.queueItem.findUnique({
      where: { id: party.current_queue_item_id },
      include: { song: true, added_by_session: { select: { name: true } } },
    });
  }

  let reactions: { name: string; reaction_type: string }[] = [];
  if (party.current_queue_item_id) {
    const rawReactions = await prisma.reaction.findMany({
      where: { queue_item_id: party.current_queue_item_id },
      include: { session: { select: { name: true } } },
    });
    reactions = rawReactions.map((r) => ({
      name: r.session.name,
      reaction_type: r.reaction_type,
    }));
  }

  const isPlaying = party.is_paused === 0;
  let positionMs = party.playback_position_ms;

  if (isPlaying) {
    const startedAt = partyPlayback.get(partyId);
    if (startedAt) {
      positionMs += Date.now() - startedAt;
    }
  }

  return serializeBigInts({ currentItem, isPlaying, positionMs, reactions });
}

async function broadcastPlaybackState(partyId: string) {
  const state = await getPlaybackState(partyId);
  if (state) io.to(partyId).emit("playback_state", state);
}

async function advanceSong(partyId: string, direction: "next" | "prev") {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return;

  const wasPlaying = party.is_paused === 0;
  let targetItem = null;

  if (party.current_queue_item_id) {
    const current = await prisma.queueItem.findUnique({
      where: { id: party.current_queue_item_id },
    });
    if (current) {
      targetItem = await prisma.queueItem.findFirst({
        where: {
          party_id: partyId,
          position: direction === "next" ? { gt: current.position } : { lt: current.position },
        },
        orderBy: { position: direction === "next" ? "asc" : "desc" },
        include: { song: true },
      });
    }
  }

  if (!targetItem) {
    partyPlayback.delete(partyId);
    pendingPlay.delete(partyId);
    // End of queue (or no "next"): clear now-playing so the party is idle and ready for new adds.
    // For "prev" with no earlier track, keep current_queue_item_id (stay on first song).
    await prisma.party.update({
      where: { id: partyId },
      data:
        direction === "next"
          ? { is_paused: 1, playback_position_ms: 0, current_queue_item_id: null }
          : { is_paused: 1, playback_position_ms: 0 },
    });
    await broadcastPlaybackState(partyId);
    return;
  }

  const songReady = targetItem.song.download_status === "complete" && targetItem.song.audio_path;

  if (songReady) {
    partyPlayback.set(partyId, Date.now());
    pendingPlay.delete(partyId);
  } else {
    partyPlayback.delete(partyId);
    pendingPlay.add(partyId);
  }

  await prisma.party.update({
    where: { id: partyId },
    data: {
      current_queue_item_id: targetItem.id,
      playback_position_ms: 0,
      is_paused: 0,
    },
  });

  await broadcastPlaybackState(partyId);
}

app.get("/api/parties/:partyId/playback", async (req, res) => {
  const authToken = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!authToken) { res.status(401).json({ error: "No token" }); return; }

  const session = await prisma.session.findFirst({
    where: { token: authToken, party_id: partyId },
  });
  if (!session) { res.status(403).json({ error: "Not in this party" }); return; }

  const state = await getPlaybackState(partyId);
  res.json(state);
});

async function scrapePreviewUrl(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`);
    const html = await res.text();
    const match = html.match(/"audioPreview":\s*\{[^}]*"url":\s*"([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function ensureSongPreviewUrl(songId: number): Promise<string | null> {
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) return null;
  if (song.preview_url) return song.preview_url;

  const token = await getSpotifyToken();
  const q = `${song.song_name} ${song.artist_name}`;
  const searchUrl = `https://api.spotify.com/v1/search?${new URLSearchParams({ q, type: "track", limit: "1" })}`;
  const spotifyRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await spotifyRes.json()) as {
    tracks?: { items?: { id: string; preview_url: string | null }[] };
  };
  const track = data.tracks?.items?.[0];
  if (!track) return null;
  let previewUrl = track.preview_url ?? null;
  if (!previewUrl) {
    previewUrl = await scrapePreviewUrl(track.id);
  }
  if (previewUrl) {
    await prisma.song.update({ where: { id: songId }, data: { preview_url: previewUrl } });
  }
  return previewUrl;
}

app.post("/api/parties", async (req, res) => {
  const { hostName, partyName } = req.body;

  if (!hostName || !partyName) {
    res.status(400).json({ error: "hostName and partyName are required" });
    return;
  }

  const partyId = crypto.randomBytes(4).toString("hex").toUpperCase();
  const now = BigInt(Date.now());

  const sessionToken = crypto.randomBytes(32).toString("hex");

  const result = await prisma.$transaction(async (tx) => {
    await tx.party.create({
      data: { id: partyId, party_name: partyName, created_at: now },
    });

    const session = await tx.session.create({
      data: { token: sessionToken, name: hostName, party_id: partyId, peanut_score: 0, created_at: now },
    });

    const party = await tx.party.update({
      where: { id: partyId },
      data: { host_id: session.id },
      include: { host: true, sessions: true },
    });

    return { party, sessionToken: session.token };
  });

  res.json(result);
});

app.get("/api/parties/:partyId/preview", async (req, res) => {
  const { partyId } = req.params;
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    select: { party_name: true },
  });
  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }
  res.json({ party_name: party.party_name });
});

app.get("/api/parties/:partyId/session", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token, party_id: partyId },
  });

  if (!session) {
    res.status(403).json({ error: "Not a member of this party" });
    return;
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { host: true, sessions: true },
  });

  res.json({ session, party });
});

app.post("/api/parties/:partyId/join", async (req, res) => {
  const { name } = req.body;
  const { partyId } = req.params;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) {
    res.status(404).json({ error: "Party not found" });
    return;
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const now = BigInt(Date.now());

  const session = await prisma.session.create({
    data: { token: sessionToken, name, party_id: partyId, peanut_score: 0, created_at: now },
  });

  res.json({ session, sessionToken: session.token });

  const members = await prisma.session.findMany({
    where: { party_id: partyId },
    select: { id: true, name: true, peanut_score: true },
  });
  io.to(partyId).emit("members_updated", members);
});

app.post("/api/parties/:partyId/leave", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { token, party_id: partyId },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await prisma.session.delete({ where: { id: session.id } });

  res.json({ ok: true });

  await broadcastMembers(partyId);
});

app.post("/api/parties/:partyId/kick/:sessionId", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { partyId, sessionId } = req.params;

  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const caller = await prisma.session.findFirst({
    where: { token, party_id: partyId },
  });

  if (!caller) {
    res.status(403).json({ error: "Not in this party" });
    return;
  }

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party || party.host_id !== caller.id) {
    res.status(403).json({ error: "Only the host can remove members" });
    return;
  }

  const targetId = parseInt(sessionId, 10);
  if (targetId === caller.id) {
    res.status(400).json({ error: "Cannot kick yourself" });
    return;
  }

  await prisma.session.delete({ where: { id: targetId } });

  res.json({ ok: true });

  const kickedSockets = await io.in(partyId).fetchSockets();
  for (const s of kickedSockets) {
    if (s.data.session?.id === targetId) {
      s.emit("kicked");
      s.disconnect();
    }
  }

  await broadcastMembers(partyId);
});

app.post("/api/parties/:partyId/start", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { partyId } = req.params;

  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }

  const caller = await prisma.session.findFirst({
    where: { token, party_id: partyId },
  });

  if (!caller) {
    res.status(403).json({ error: "Not in this party" });
    return;
  }

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party || party.host_id !== caller.id) {
    res.status(403).json({ error: "Only the host can start the party" });
    return;
  }

  await prisma.party.update({
    where: { id: partyId },
    data: { has_started: 1 },
  });

  res.json({ ok: true });

  io.to(partyId).emit("party_started");
});

async function broadcastMembers(partyId: string) {
  const members = await prisma.session.findMany({
    where: { party_id: partyId },
    select: { id: true, name: true, peanut_score: true },
  });
  io.to(partyId).emit("members_updated", members);
}

io.on("connection", async (socket) => {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    socket.disconnect();
    return;
  }

  const session = await prisma.session.findFirst({ where: { token } });
  if (!session) {
    socket.disconnect();
    return;
  }

  socket.data.session = session;
  socket.join(session.party_id);

  await broadcastMembers(session.party_id);

  const playbackState = await getPlaybackState(session.party_id);
  if (playbackState) socket.emit("playback_state", playbackState);

  socket.on("host_play", async () => {
    const partyId = session.party_id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.host_id !== session.id) return;

    if (!party.current_queue_item_id) {
      const first = await prisma.queueItem.findFirst({
        where: { party_id: partyId },
        orderBy: { position: "asc" },
      });
      if (!first) return;
      await prisma.party.update({
        where: { id: partyId },
        data: { current_queue_item_id: first.id, playback_position_ms: 0 },
      });
      party.current_queue_item_id = first.id;
      party.playback_position_ms = 0;
    }

    const currentItem = await prisma.queueItem.findUnique({
      where: { id: party.current_queue_item_id! },
      include: { song: true },
    });

    if (!currentItem?.song.audio_path || currentItem.song.download_status !== "complete") {
      pendingPlay.add(partyId);
      await prisma.party.update({ where: { id: partyId }, data: { is_paused: 0 } });
      await broadcastPlaybackState(partyId);
      return;
    }

    partyPlayback.set(partyId, Date.now());
    pendingPlay.delete(partyId);
    await prisma.party.update({ where: { id: partyId }, data: { is_paused: 0 } });
    await broadcastPlaybackState(partyId);
  });

  socket.on("host_pause", async () => {
    const partyId = session.party_id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.host_id !== session.id) return;

    const startedAt = partyPlayback.get(partyId);
    let positionMs = party.playback_position_ms;
    if (startedAt) positionMs += Date.now() - startedAt;

    partyPlayback.delete(partyId);
    pendingPlay.delete(partyId);

    await prisma.party.update({
      where: { id: partyId },
      data: { is_paused: 1, playback_position_ms: positionMs },
    });
    await broadcastPlaybackState(partyId);
  });

  socket.on("host_skip", async () => {
    const partyId = session.party_id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.host_id !== session.id) return;
    await advanceSong(partyId, "next");
  });

  socket.on("host_prev", async () => {
    const partyId = session.party_id;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.host_id !== session.id) return;
    await advanceSong(partyId, "prev");
  });

  socket.on("song_ended", async (data?: { queueItemId?: number }) => {
    const partyId = session.party_id;
    if (data?.queueItemId) {
      const party = await prisma.party.findUnique({ where: { id: partyId }, select: { current_queue_item_id: true } });
      if (!party || party.current_queue_item_id !== data.queueItemId) return;
    }
    await advanceSong(partyId, "next");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", session.name);
  });
});

const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api|\/downloads|\/health|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

async function recoverDownloads() {
  const completeSongs = await prisma.song.findMany({
    where: { download_status: "complete", audio_path: { not: null } },
  });

  for (const song of completeSongs) {
    const filePath = path.join(DOWNLOADS_DIR, path.basename(song.audio_path!));
    if (!fs.existsSync(filePath)) {
      console.log(`Missing file for song ${song.id} ("${song.song_name}"), resetting to pending`);
      await prisma.song.update({
        where: { id: song.id },
        data: { download_status: "pending", audio_path: null },
      });
    }
  }

  const pendingSongs = await prisma.song.findMany({
    where: { download_status: "pending" },
    include: { queue_items: { take: 1, include: { party: true } } },
  });

  for (const song of pendingSongs) {
    const partyId = song.queue_items[0]?.party_id;
    if (!partyId) continue;
    console.log(`Retrying download for song ${song.id}: "${song.song_name}" by ${song.artist_name}`);
    downloadSong(song.id, song.song_name, song.artist_name, "", partyId);
  }
}

server.listen(Number(env.PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${env.PORT}`);
  recoverDownloads().catch((err) => console.error("Download recovery failed:", err));
});
