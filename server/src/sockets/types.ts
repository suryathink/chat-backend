import type { Chat, LastSeen, Message, ReadReceipt } from "../types";

/** Reply passed to the client's acknowledgement callback. */
export type AckResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; details?: Record<string, string[]> } };

export type Ack<T> = (response: AckResponse<T>) => void;

/** Events the server sends. */
export interface ServerToClientEvents {
  "chat:created": (chat: Chat) => void;
  "message:new": (message: Message) => void;
  "message:edited": (message: Message) => void;
  "message:deleted": (message: Message) => void;
  "message:read": (receipt: ReadReceipt) => void;
  "lastseen:updated": (lastSeen: LastSeen) => void;
}

/**
 * Events the client sends. Payloads are `unknown` on purpose: anything can
 * arrive over the wire, so every handler validates with zod first.
 */
export interface ClientToServerEvents {
  "chat:join": (payload: unknown, ack?: Ack<{ chatId: string }>) => void;
  "chat:leave": (payload: unknown, ack?: Ack<{ chatId: string }>) => void;
  "message:send": (payload: unknown, ack?: Ack<Message>) => void;
  "message:read": (payload: unknown, ack?: Ack<Message>) => void;
  "message:edit": (payload: unknown, ack?: Ack<Message>) => void;
  "message:delete": (payload: unknown, ack?: Ack<Message>) => void;
  "lastseen:update": (payload: unknown, ack?: Ack<{ lastSeen: LastSeen; updated: boolean }>) => void;
}

export type InterServerEvents = Record<string, never>;

/** Set once during the handshake; trusted for the rest of the connection. */
export interface SocketData {
  userId: string;
}
