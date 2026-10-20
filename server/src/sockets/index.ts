import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";
import { logger } from "../configs/logger";
import { domainEvents } from "../helpers/events";
import { UserModel } from "../models/user.model";
import { chatRoom, registerChatHandlers, userRoom } from "./chat.socket";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types";

const handshakeSchema = z.object({
  userId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
});

export const initSockets = (httpServer: HttpServer, corsOrigin: string | string[]) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    { cors: { origin: corsOrigin } },
  );

  // Handshake: client connects with io(url, { auth: { userId } }).
  io.use(async (socket, next) => {
    try {
      const parsed = handshakeSchema.safeParse(socket.handshake.auth);
      if (!parsed.success) return next(new Error("auth.userId must be a valid UUID"));

      const user = await UserModel.findById(parsed.data.userId);
      if (!user) return next(new Error("Unknown user"));

      socket.data.userId = user.id;
      return next();
    } catch (err) {
      logger.error("socket handshake failed:", err);
      return next(new Error("Internal server error"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data;
    // Personal room: lets us notify the user about new chats on every device.
    void socket.join(userRoom(userId));
    logger.debug(`socket connected: user=${userId} socket=${socket.id}`);

    registerChatHandlers(socket);

    socket.on("disconnect", (reason) => {
      logger.debug(`socket disconnected: user=${userId} reason=${reason}`);
    });
  });

  // Broadcast domain events, whether they came from REST or from a socket.
  domainEvents.on("chat:created", (chat) => {
    io.to(chat.memberIds.map(userRoom)).emit("chat:created", chat);
  });
  domainEvents.on("message:new", (message) => {
    io.to(chatRoom(message.chatId)).emit("message:new", message);
  });
  domainEvents.on("message:read", (receipt) => {
    io.to(chatRoom(receipt.chatId)).emit("message:read", receipt);
  });
  domainEvents.on("lastseen:updated", (lastSeen) => {
    io.to(chatRoom(lastSeen.chatId)).emit("lastseen:updated", lastSeen);
  });

  return io;
};
