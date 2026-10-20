import type { Socket } from "socket.io";
import type { z } from "zod";
import { logger } from "../configs/logger";
import { toErrorResponse } from "../helpers/AppError";
import { socketSchemas } from "../helpers/schemas";
import { chatService } from "../services/chat.service";
import { messageService } from "../services/message.service";
import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const chatRoom = (chatId: string) => `chat:${chatId}`;
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Wraps a handler: validates the payload, runs it, and answers through the
 * ack callback with { ok, data } or { ok: false, error }.
 */
const handle =
  <S extends z.ZodTypeAny, T>(event: string, schema: S, run: (input: z.infer<S>) => Promise<T>) =>
  async (payload: unknown, ack?: Ack<T>) => {
    try {
      const data = await run(schema.parse(payload));
      if (typeof ack === "function") ack({ ok: true, data });
    } catch (err) {
      const { message, details, expected } = toErrorResponse(err);
      if (!expected) logger.error(`socket event "${event}" failed:`, err);
      if (typeof ack === "function") ack({ ok: false, error: { message, ...(details && { details }) } });
    }
  };

export const registerChatHandlers = (socket: ChatSocket) => {
  // The acting user always comes from the handshake, never from the payload.
  const { userId } = socket.data;

  socket.on(
    "chat:join",
    handle("chat:join", socketSchemas.joinChat, async ({ chatId }) => {
      await chatService.getForMember(chatId, userId);
      await socket.join(chatRoom(chatId));
      return { chatId };
    }),
  );

  socket.on(
    "chat:leave",
    handle("chat:leave", socketSchemas.joinChat, async ({ chatId }) => {
      await socket.leave(chatRoom(chatId));
      return { chatId };
    }),
  );

  // The handlers below call the same services as the REST API; the resulting
  // broadcasts come from the domain events in sockets/index.ts.
  socket.on(
    "message:send",
    handle("message:send", socketSchemas.sendMessage, ({ chatId, text }) =>
      messageService.send(chatId, userId, text),
    ),
  );

  socket.on(
    "message:read",
    handle("message:read", socketSchemas.markRead, ({ chatId, messageId }) =>
      messageService.markRead(chatId, messageId, userId),
    ),
  );

  socket.on(
    "message:edit",
    handle("message:edit", socketSchemas.editMessage, ({ chatId, messageId, text }) =>
      messageService.edit(chatId, messageId, userId, text),
    ),
  );

  socket.on(
    "message:delete",
    handle("message:delete", socketSchemas.deleteMessage, ({ chatId, messageId }) =>
      messageService.remove(chatId, messageId, userId),
    ),
  );

  socket.on(
    "lastseen:update",
    handle("lastseen:update", socketSchemas.lastSeen, ({ chatId, messageId }) =>
      messageService.updateLastSeen(chatId, userId, messageId),
    ),
  );
};
