import type { Request, Response } from "express";
import { status } from "http-status";
import {
  createChatSchema,
  getMessagesSchema,
  lastSeenSchema,
  markReadSchema,
  parseRequest,
  sendMessageSchema,
} from "../helpers/schemas";
import { chatService } from "../services/chat.service";
import { messageService } from "../services/message.service";

// POST /chat/create
export const createChat = async (req: Request, res: Response) => {
  const { body } = parseRequest(createChatSchema, req);
  const { chat, created } = await chatService.createOrGet(body.userAId, body.userBId);
  res.status(created ? status.CREATED : status.OK).json({ chatId: chat.id, created, chat });
};

// POST /chat/:chatId/message/send
export const sendMessage = async (req: Request, res: Response) => {
  const { params, body } = parseRequest(sendMessageSchema, req);
  const message = await messageService.send(params.chatId, body.senderId, body.text);
  res.status(status.CREATED).json({ message });
};

// GET /chat/:chatId/messages?limit=50&before=<messageId>
export const getMessages = async (req: Request, res: Response) => {
  const { params, query } = parseRequest(getMessagesSchema, req);
  const result = await messageService.list(params.chatId, query.limit, query.before);
  res.status(status.OK).json(result);
};

// POST /chat/:chatId/message/:messageId/read
export const markMessageRead = async (req: Request, res: Response) => {
  const { params, body } = parseRequest(markReadSchema, req);
  const message = await messageService.markRead(params.chatId, params.messageId, body.userId);
  res.status(status.OK).json({ message });
};

// POST /chat/:chatId/lastseen
export const updateLastSeen = async (req: Request, res: Response) => {
  const { params, body } = parseRequest(lastSeenSchema, req);
  const result = await messageService.updateLastSeen(params.chatId, body.userId, body.messageId);
  res.status(status.OK).json(result);
};
