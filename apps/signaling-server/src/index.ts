import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger, SIGNALING_PATH, HEALTHZ_PATH, setLogFormat } from "@uos/shared";
import { validateMessage, isValidWebSocketMessage } from "./protocol";
import {
  createRoom,
  addViewerToRoom,
  removePeer,
  cleanOrphanRooms,
  getHostPeerId,
  sendToRoomExcept,
  sendToPeer,
} from "./rooms";

function loadEnvFile(): void {
  try {
    const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const envPath = resolve(rootDir, ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

loadEnvFile();

if (process.env.LOG_FORMAT === "json" || !process.env.LOG_FORMAT) {
  setLogFormat("json");
}

const PORT = Number(process.env.SIGNALING_PORT) || Number(process.env.PORT) || 3000;
const WS_PATH = process.env.SIGNALING_PATH || SIGNALING_PATH;

const server = createServer((req, res) => {
  if (req.url === HEALTHZ_PATH) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on("connection", (ws: WebSocket) => {
  let peerId: string | undefined;
  let boundRoomId: string | undefined;

  function sendError(code: string, message: string): void {
    ws.send(JSON.stringify({ type: "error", code, message }));
  }

  ws.on("message", (raw: Buffer) => {
    if (!isValidWebSocketMessage(raw)) {
      sendError("MESSAGE_TOO_LARGE", "Message too large");
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      sendError("INVALID_JSON", "Invalid JSON");
      return;
    }

    const msg = validateMessage(data);
    if (!msg) {
      sendError("INVALID_MESSAGE", "Invalid message format");
      return;
    }

    switch (msg.type) {
      case "create-room": {
        if (boundRoomId) {
          sendError("ALREADY_IN_ROOM", "Already in a room");
          return;
        }

        peerId = msg.peerId!;
        const room = createRoom(ws, peerId);
        boundRoomId = room.roomId;

        ws.send(
          JSON.stringify({
            type: "room-created",
            roomId: room.roomId,
            hostPeerId: peerId,
          }),
        );
        break;
      }

      case "join-room": {
        if (!msg.roomId) return;

        if (boundRoomId) {
          sendError("ALREADY_IN_ROOM", "Already in a room");
          return;
        }

        peerId = msg.peerId!;

        const result = addViewerToRoom(msg.roomId, ws, peerId);
        if (!result.success) {
          const errorMessages: Record<string, string> = {
            ROOM_NOT_FOUND: "Room not found",
            ROOM_HAS_NO_HOST: "Room has no host",
            ROOM_FULL: "Room is full",
          };
          sendError(result.error, errorMessages[result.error] || "Unknown error");
          return;
        }

        boundRoomId = msg.roomId;

        ws.send(
          JSON.stringify({
            type: "viewer-accepted",
            roomId: msg.roomId,
            viewerPeerId: peerId,
          }),
        );

        const hostPeerId = getHostPeerId(msg.roomId);
        if (hostPeerId) {
          sendToPeer(hostPeerId, {
            type: "viewer-joined",
            roomId: msg.roomId,
            viewerPeerId: peerId,
          });
        }
        break;
      }

      case "leave": {
        if (!peerId) return;
        if (msg.roomId && boundRoomId) {
          sendToRoomExcept(msg.roomId, peerId, {
            type: "leave",
            roomId: msg.roomId,
            peerId,
          });
        }
        cleanupPeer(peerId);
        break;
      }

      case "offer":
      case "answer":
      case "ice-candidate": {
        if (!peerId) return;
        if (!msg.roomId || !msg.toPeerId) return;

        const forward = { ...msg, fromPeerId: peerId };
        const sent = sendToPeer(msg.toPeerId, forward);
        if (!sent) {
          sendError("PEER_NOT_FOUND", "Target peer not found");
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    if (peerId) {
      cleanupPeer(peerId);
    }
  });

  ws.on("error", (err: Error) => {
    logger.error("WebSocket error", { peerId });
    logger.error(err.message);
    if (peerId) {
      cleanupPeer(peerId);
    }
  });

  function cleanupPeer(pid: string): void {
    const result = removePeer(pid);
    if (result && !result.wasHost) {
      const leaveMsg = {
        type: "leave" as const,
        roomId: result.roomId,
        peerId: pid,
      };
      sendToRoomExcept(result.roomId, pid, leaveMsg);
    }
    boundRoomId = undefined;
    peerId = undefined;
  }
});

setInterval(() => {
  cleanOrphanRooms();
}, 60_000);

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Signaling server started on port ${PORT}`);
  logger.info(`WebSocket path: ${WS_PATH}`);
  logger.info(`Health check: http://localhost:${PORT}${HEALTHZ_PATH}`);
});
