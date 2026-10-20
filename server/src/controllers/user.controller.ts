import type { Request, Response } from "express";
import { status } from "http-status";
import { createUserSchema, parseRequest, userChatsSchema } from "../helpers/schemas";
import { chatService } from "../services/chat.service";
import { userService } from "../services/user.service";

// POST /user/create  (helper for testing; not part of the assignment)
export const createUser = async (req: Request, res: Response) => {
  const { body } = parseRequest(createUserSchema, req);
  const user = await userService.create(body.name);
  res.status(status.CREATED).json({ user });
};

// GET /user/:userId/chats
export const getUserChats = async (req: Request, res: Response) => {
  const { params } = parseRequest(userChatsSchema, req);
  const chats = await chatService.listForUser(params.userId);
  res.status(status.OK).json({ chats });
};
