export type Role = "host" | "viewer";

export interface BaseMessage {
  type: string;
  roomId?: string;
  peerId?: string;
}

export interface CreateRoomMessage extends BaseMessage {
  type: "create-room";
  role: "host";
}

export interface RoomCreatedMessage extends BaseMessage {
  type: "room-created";
  roomId: string;
  hostPeerId: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: "join-room";
  role: "viewer";
  roomId: string;
}

export interface ViewerJoinedMessage extends BaseMessage {
  type: "viewer-joined";
  roomId: string;
  viewerPeerId: string;
}

export interface OfferMessage extends BaseMessage {
  type: "offer";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends BaseMessage {
  type: "answer";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage extends BaseMessage {
  type: "ice-candidate";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  candidate: RTCIceCandidateInit;
}

export interface LeaveMessage extends BaseMessage {
  type: "leave";
  roomId: string;
  peerId: string;
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  code: string;
  message: string;
}

export type SignalMessage =
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | ViewerJoinedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | LeaveMessage
  | ErrorMessage;

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcConfig {
  iceServers: IceServerConfig[];
}

export const DEFAULT_RTC_CONFIG: RtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export const MAX_VIEWERS_PER_ROOM = 4;

export const SIGNALING_PATH = "/ws";
export const HEALTHZ_PATH = "/healthz";


