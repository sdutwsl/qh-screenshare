import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { logger, SIGNALING_PATH, HEALTHZ_PATH } from "@uos/shared";
import { validateMessage, isValidWebSocketMessage } from "./protocol";
import {
  createRoom,
  addViewerToRoom,
  removePeer,
  cleanOrphanRooms,
  getHostPeerId,
  getViewerPeerIds,
  sendToRoomExcept,
  sendToPeer,
} from "./rooms";

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
  const peerId = randomUUID();
  let boundRoomId: string | undefined;

  logger.info("Client connected", { peerId });

  ws.on("message", (raw: Buffer) => {
    if (!isValidWebSocketMessage(raw)) {
      ws.send(
        JSON.stringify({ type: "error", code: "MESSAGE_TOO_LARGE", message: "Message too large" }),
      );
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      ws.send(
        JSON.stringify({ type: "error", code: "INVALID_JSON", message: "Invalid JSON" }),
      );
      return;
    }

    const msg = validateMessage(data);
    if (!msg) {
      ws.send(
        JSON.stringify({ type: "error", code: "INVALID_MESSAGE", message: "Invalid message format" }),
      );
      return;
    }

    switch (msg.type) {
      case "create-room": {
        if (boundRoomId) {
          ws.send(
            JSON.stringify({ type: "error", code: "ALREADY_IN_ROOM", message: "Already in a room" }),
          );
          return;
        }

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
          ws.send(
            JSON.stringify({ type: "error", code: "ALREADY_IN_ROOM", message: "Already in a room" }),
          );
          return;
        }

        const result = addViewerToRoom(msg.roomId, ws, peerId);
        if (!result.success) {
          const errorMessages: Record<string, string> = {
            ROOM_NOT_FOUND: "Room not found",
            ROOM_HAS_NO_HOST: "Room has no host",
            ROOM_FULL: "Room is full",
          };
          ws.send(
            JSON.stringify({
              type: "error",
              code: result.error,
              message: errorMessages[result.error] || "Unknown error",
            }),
          );
          return;
        }

        boundRoomId = msg.roomId;

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
        if (!msg.roomId || !msg.toPeerId) return;

        const forward = { ...msg, fromPeerId: peerId };
        const sent = sendToPeer(msg.toPeerId, forward);
        if (!sent) {
          ws.send(
            JSON.stringify({
              type: "error",
              code: "PEER_NOT_FOUND",
              message: "Target peer not found",
            }),
          );
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    logger.info("Client disconnected", { peerId });
    cleanupPeer(peerId);
  });

  ws.on("error", (err: Error) => {
    logger.error("WebSocket error", { peerId });
    logger.error(err.message);
    cleanupPeer(peerId);
  });

  function cleanupPeer(pid: string): void {
    const room = removePeer(pid);
    if (room) {
      const leaveMsg = {
        type: "leave" as const,
        roomId: room.roomId,
        peerId: pid,
      };
      sendToRoomExcept(room.roomId, pid, leaveMsg);

      for (const vId of getViewerPeerIds(room.roomId)) {
        sendToPeer(vId, leaveMsg);
      }
    }
    boundRoomId = undefined;
  }
});

setInterval(() => {
  cleanOrphanRooms();
}, 60_000);

server.listen(PORT, () => {
  logger.info(`Signaling server started on port ${PORT}`);
  logger.info(`WebSocket path: ${WS_PATH}`);
  logger.info(`Health check: http://localhost:${PORT}${HEALTHZ_PATH}`);
});
