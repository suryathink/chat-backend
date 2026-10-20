import { randomUUID } from "crypto";
import { AppError } from "../helpers/AppError";
import { domainEvents } from "../helpers/events";
import { ChatModel } from "../models/chat.model";
import type { Chat } from "../types";
import { userService } from "./user.service";

export const chatService = {
  /** Returns the existing 1:1 chat between the two users, or creates it. */
  async createOrGet(userAId: string, userBId: string): Promise<{ chat: Chat; created: boolean }> {
    if (userAId === userBId) {
      throw AppError.badRequest("A chat needs two different users");
    }
    await userService.assertExists(userAId, userBId);

    // Canonical order: (A, B) and (B, A) are the same chat.
    const [lowId, highId] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

    const newId = randomUUID();
    await ChatModel.insertIfAbsent(newId, lowId, highId);
    const chat = await ChatModel.findByPair(lowId, highId);
    if (!chat) throw new Error(`Chat for ${lowId}/${highId} missing after upsert`);

    // If the stored row carries the id we just generated, this call created it.
    // (affectedRows is unreliable here: mysql2 enables FOUND_ROWS by default,
    // so a no-op duplicate also reports 1.)
    const created = chat.id === newId;

    if (created) domainEvents.emit("chat:created", chat);
    return { chat, created };
  },

  async listForUser(userId: string): Promise<Chat[]> {
    await userService.assertExists(userId);
    return ChatModel.findByUserId(userId);
  },

  async getById(chatId: string): Promise<Chat> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) throw AppError.notFound(`Chat not found: ${chatId}`);
    return chat;
  },

  /** Loads the chat and checks the user is one of its two members. */
  async getForMember(chatId: string, userId: string): Promise<Chat> {
    const chat = await chatService.getById(chatId);
    if (!chat.memberIds.includes(userId)) {
      throw AppError.forbidden("User is not a member of this chat");
    }
    return chat;
  },
};
