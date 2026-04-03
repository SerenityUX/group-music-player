FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    unzip \
    openssl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN cd frontend && VITE_API_URL="" npm run build

ENV DATABASE_URL="file:./dev.db"

RUN cd backend && npx prisma generate && npm run build

EXPOSE 3000

CMD cd /app/backend && npx prisma migrate deploy && node dist/index.js
