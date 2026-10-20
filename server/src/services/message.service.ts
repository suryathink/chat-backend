import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../configs/firebase";
import { AppError } from "../helpers/AppError";
import { domainEvents } from "../helpers/events";
import {
  compareMessagePosition,
  lastSeenCollection,
  messagesCollection,
  toLastSeen,
  toMessage,
} from "../models/message.model";
import type { MessageDoc } from "../models/message.model";
import type { LastSeen, Message, ReadReceipt } from "../types";
import { chatService } from "./chat.service";

/** The message must exist and belong to `userId`; only the sender may edit or delete it. */
const assertOwnMessage = (doc: MessageDoc | undefined, messageId: string, userId: string): MessageDoc => {
  if (!doc) throw AppError.notFound(`Message not found: ${messageId}`);
  if (doc.senderId !== userId) {
    throw AppError.forbidden("Only the sender can edit or delete this message");
  }
  return doc;
};

export const messageService = {
  async send(chatId: string, senderId: string, text: string): Promise<Message> {
    await chatService.getForMember(chatId, senderId);

    const ref = messagesCollection(chatId).doc();
    // Server timestamp, not the client's or this Node process's clock:
    // one clock for every writer keeps the ordering consistent.
    // The sender has read their own message: "has X read it?" is always just
    // readBy[X], and unread counts never include your own messages.
    // Both server timestamps resolve to the same commit time.
    await ref.set({
      senderId,
      text,
      createdAt: FieldValue.serverTimestamp(),
      readBy: { [senderId]: FieldValue.serverTimestamp() },
    });

    // Read back once to get the timestamp Firestore actually assigned.
    const snapshot = await ref.get();
    const doc = snapshot.data();
    if (!doc) throw new Error(`Message ${ref.id} missing right after write`);

    const message = toMessage(chatId, ref.id, doc);
    domainEvents.emit("message:new", message);
    return message;
  },

  /**
   * Latest `limit` messages, returned oldest -> newest.
   * Pass `before` (a message id) to page further back in history.
   */
  async list(
    chatId: string,
    limit: number,
    before?: string,
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    await chatService.getById(chatId);

    const collection = messagesCollection(chatId);
    // Newest first so `limit` keeps the most recent messages; document id breaks
    // ties between messages with the same timestamp so the order is stable.
    let query = collection
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(limit);

    if (before) {
      const cursor = await collection.doc(before).get();
      if (!cursor.exists) throw AppError.notFound(`Message not found: ${before}`);
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map((doc) => toMessage(chatId, doc.id, doc.data())).reverse();

    // A full page means there may be older messages; the oldest id is the next cursor.
    const nextCursor = snapshot.size === limit ? (messages[0]?.id ?? null) : null;
    return { messages, nextCursor };
  },

  /**
   * Records that `userId` read the message. Idempotent: the first read time is
   * kept. The sender is already in readBy from send(), so for them it's a no-op.
   */
  async markRead(chatId: string, messageId: string, userId: string): Promise<Message> {
    await chatService.getForMember(chatId, userId);
    const ref = messagesCollection(chatId).doc(messageId);

    // Transaction so the "already read?" check and the write can't interleave
    // with another request for the same message.
    const { message, receipt } = await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const doc = snapshot.data();
      if (!doc) throw AppError.notFound(`Message not found: ${messageId}`);

      if (doc.senderId === userId || doc.readBy[userId]) {
        return { message: toMessage(chatId, messageId, doc), receipt: null };
      }

      // Informational time (not used for ordering), so the local clock is fine
      // and saves reading the document back.
      const readAt = Timestamp.now();
      // FieldPath (not a "readBy.<id>" string) so the id is never parsed as a path.
      tx.update(ref, new FieldPath("readBy", userId), readAt);

      const updated = { ...doc, readBy: { ...doc.readBy, [userId]: readAt } };
      const newReceipt: ReadReceipt = {
        chatId,
        messageId,
        userId,
        readAt: readAt.toDate().toISOString(),
      };
      return { message: toMessage(chatId, messageId, updated), receipt: newReceipt };
    });

    if (receipt) domainEvents.emit("message:read", receipt);
    return message;
  },

  /** Replaces the text of a message. Only its sender can, and not once deleted. */
  async edit(chatId: string, messageId: string, userId: string, text: string): Promise<Message> {
    await chatService.getForMember(chatId, userId);
    const ref = messagesCollection(chatId).doc(messageId);

    // Transaction: an edit racing a delete must not write text back into a
    // message that was just deleted.
    const message = await firestore.runTransaction(async (tx) => {
      const doc = assertOwnMessage((await tx.get(ref)).data(), messageId, userId);
      if (doc.deletedAt) throw AppError.conflict("Message has been deleted and can't be edited");

      const editedAt = Timestamp.now();
      tx.update(ref, { text, editedAt });
      return toMessage(chatId, messageId, { ...doc, text, editedAt });
    });

    domainEvents.emit("message:edited", message);
    return message;
  },

  /**
   * Soft delete: clears the text and sets deletedAt, keeping the document so
   * clients can show "message deleted" and cursors/lastSeen stay valid.
   * Only the sender can delete. Deleting twice is a no-op.
   */
  async remove(chatId: string, messageId: string, userId: string): Promise<Message> {
    await chatService.getForMember(chatId, userId);
    const ref = messagesCollection(chatId).doc(messageId);

    const { message, changed } = await firestore.runTransaction(async (tx) => {
      const doc = assertOwnMessage((await tx.get(ref)).data(), messageId, userId);
      if (doc.deletedAt) return { message: toMessage(chatId, messageId, doc), changed: false };

      const deletedAt = Timestamp.now();
      tx.update(ref, { text: "", deletedAt });
      return { message: toMessage(chatId, messageId, { ...doc, text: "", deletedAt }), changed: true };
    });

    if (changed) domainEvents.emit("message:deleted", message);
    return message;
  },

  /**
   * Moves the user's "last seen message" pointer for this chat.
   * Only moves forward: a late request for an older message is ignored.
   */
  async updateLastSeen(
    chatId: string,
    userId: string,
    messageId: string,
  ): Promise<{ lastSeen: LastSeen; updated: boolean }> {
    await chatService.getForMember(chatId, userId);
    const messageRef = messagesCollection(chatId).doc(messageId);
    const lastSeenRef = lastSeenCollection(chatId).doc(userId);

    const result = await firestore.runTransaction(async (tx) => {
      const [messageSnap, lastSeenSnap] = await Promise.all([tx.get(messageRef), tx.get(lastSeenRef)]);
      const message = messageSnap.data();
      if (!message) throw AppError.notFound(`Message not found: ${messageId}`);

      const current = lastSeenSnap.data();
      const isNewer =
        !current ||
        compareMessagePosition(
          { createdAt: message.createdAt, id: messageId },
          { createdAt: current.messageCreatedAt, id: current.messageId },
        ) > 0;

      if (current && !isNewer) {
        return { lastSeen: toLastSeen(chatId, userId, current), updated: false };
      }

      const doc = { messageId, messageCreatedAt: message.createdAt, updatedAt: Timestamp.now() };
      tx.set(lastSeenRef, doc);
      return { lastSeen: toLastSeen(chatId, userId, doc), updated: true };
    });

    if (result.updated) domainEvents.emit("lastseen:updated", result.lastSeen);
    return result;
  },
};
