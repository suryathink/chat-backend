import type { Request } from "express";
import { z } from "zod";

// Lowercased so the same id always compares/sorts the same way (chat pairs are sorted).
const uuid = z
  .string()
  .uuid({ message: "must be a valid UUID" })
  .transform((value) => value.toLowerCase());
const userId = uuid;
const chatId = uuid;
// Firestore auto-ids are 20 alphanumeric chars; a "/" would break the document path.
const messageId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, { message: "invalid message id" });
const text = z.string().trim().min(1, "cannot be empty").max(2000, "max 2000 characters");

export const MAX_PAGE_SIZE = 100;

export const createUserSchema = z.object({
  body: z.object({ name: z.string().trim().min(1).max(100) }),
});

export const createChatSchema = z.object({
  body: z.object({ userAId: userId, userBId: userId }),
});

export const sendMessageSchema = z.object({
  params: z.object({ chatId }),
  body: z.object({ senderId: userId, text }),
});

export const getMessagesSchema = z.object({
  params: z.object({ chatId }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
    before: messageId.optional(),
  }),
});

export const markReadSchema = z.object({
  params: z.object({ chatId, messageId }),
  body: z.object({ userId }),
});

export const lastSeenSchema = z.object({
  params: z.object({ chatId }),
  body: z.object({ userId, messageId }),
});

export const userChatsSchema = z.object({
  params: z.object({ userId }),
});

// Socket payloads. The acting user comes from the socket handshake, not the payload.
export const socketSchemas = {
  joinChat: z.object({ chatId }),
  sendMessage: z.object({ chatId, text }),
  markRead: z.object({ chatId, messageId }),
  lastSeen: z.object({ chatId, messageId }),
};

/**
 * Parses params/query/body against a schema and returns fully typed values.
 * A ZodError is turned into a 400 by the error handler.
 */
export const parseRequest = <S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> =>
  schema.parse({ params: req.params, query: req.query, body: req.body ?? {} });
