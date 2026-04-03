import { io, Socket } from "socket.io-client";
import { API_URL } from "./config";

const SOCKET_URL = API_URL;

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
  });

  return socket;
}

/** Emit after ensuring the client is connected (safe if Party page connected first or not). */
export function emitSocketEvent(event: string, ...args: unknown[]) {
  const token = localStorage.getItem("sessionToken") ?? "";
  const sock = getSocket(token);
  if (!sock.connected) sock.connect();
  sock.emit(event, ...args);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
