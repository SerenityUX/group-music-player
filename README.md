# Music Player 

A real-time listening app. Create a party, invite friends via QR code or join code, queue up songs, listen together, react, and crown a winner.

Designed for road trips

## Prerequisites

- **Node.js** 18+
- **yt-dlp** — downloads audio from YouTube
- **FFmpeg** — required by yt-dlp for audio conversion

### Install yt-dlp & FFmpeg

**macOS (Homebrew):**
```bash
brew install yt-dlp ffmpeg
```

**Linux (apt):**
```bash
sudo apt install ffmpeg
pip install yt-dlp
```

**Windows (Chocolatey):**
```bash
choco install yt-dlp ffmpeg
```

Verify both are on your PATH:
```bash
yt-dlp --version
ffmpeg -version
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file in the project root
cp .env.example .env
```

Edit `.env` and add your Spotify API credentials:
```
DATABASE_URL="file:./dev.db"
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Get credentials at https://developer.spotify.com/dashboard — create an app, copy the Client ID and Client Secret.

```bash
# 3. Set up the database
cd backend && npx prisma db push && cd ..

# 4. Start the dev servers
npm run dev
```

This starts:
- **Backend** on `http://localhost:3000`
- **Frontend** on `http://localhost:5173`

Open the frontend URL in your browser. On the same network, other devices can join via QR code or join code.

## Project Structure

```
nero-party/
├── backend/           # Express + Prisma + Socket.IO
│   ├── prisma/        # Schema & SQLite database
│   ├── src/           # Server code
│   └── downloads/     # Downloaded audio (gitignored)
├── frontend/          # React + Vite + Tailwind
│   ├── public/        # Static assets, sounds, icons
│   └── src/           # Client code
└── .env               # Spotify credentials (gitignored)
```

## Tech Stack

- **Backend:** Express, Prisma, Socket.IO, yt-dlp
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** SQLite (local, zero config)
- **Music API:** Spotify (search + metadata), YouTube (audio via yt-dlp)
# group-music-player
