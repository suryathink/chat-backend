import { EventEmitter } from "events";
import type { Chat, LastSeen, Message, ReadReceipt } from "../types";

/**
 * Things that happened in the chat domain. Services publish them after a
 * successful write; the socket layer subscribes and broadcasts them.
 * This keeps services free of any Socket.IO code.
 */
export interface DomainEvents {
  "chat:created": [chat: Chat];
  "message:new": [message: Message];
  "message:edited": [message: Message];
  "message:deleted": [message: Message];
  "message:read": [receipt: ReadReceipt];
  "lastseen:updated": [lastSeen: LastSeen];
}

export const domainEvents = new EventEmitter<DomainEvents>();
