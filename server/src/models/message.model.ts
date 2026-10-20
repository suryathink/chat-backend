import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { firestore } from "../configs/firebase";
import type { LastSeen, Message } from "../types";

/**
 * Firestore layout:
 *   chats/{chatId}/messages/{messageId}  -> MessageDoc
 *   chats/{chatId}/lastSeen/{userId}     -> LastSeenDoc
 *
 * chats/{chatId} itself is never written; it only groups the subcollections.
 * The chat's members live in MySQL.
 */

export interface MessageDoc {
  senderId: string;
  text: string;
  createdAt: Timestamp;
  /** userId -> when that user read the message (read receipts) */
  readBy: Record<string, Timestamp>;
  /** Only present once the sender has edited the message. */
  editedAt?: Timestamp;
  /**
   * Only present once the sender has deleted the message (soft delete: the
   * text is cleared, the document stays so ordering, cursors and lastSeen
   * pointers that reference it keep working).
   */
  deletedAt?: Timestamp;
}

export interface LastSeenDoc {
  messageId: string;
  /** Copied from the message, so "is this newer?" needs no extra read. */
  messageCreatedAt: Timestamp;
  updatedAt: Timestamp;
}

const converter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
  toFirestore: (data) => data as DocumentData,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => snapshot.data() as T,
});

const chatDoc = (chatId: string) => firestore.collection("chats").doc(chatId);

export const messagesCollection = (chatId: string) =>
  chatDoc(chatId).collection("messages").withConverter(converter<MessageDoc>());

export const lastSeenCollection = (chatId: string) =>
  chatDoc(chatId).collection("lastSeen").withConverter(converter<LastSeenDoc>());

export const toMessage = (chatId: string, id: string, doc: MessageDoc): Message => ({
  id,
  chatId,
  senderId: doc.senderId,
  text: doc.text,
  createdAt: doc.createdAt.toDate().toISOString(),
  readBy: Object.fromEntries(
    Object.entries(doc.readBy).map(([userId, at]) => [userId, at.toDate().toISOString()]),
  ),
  editedAt: doc.editedAt ? doc.editedAt.toDate().toISOString() : null,
  deletedAt: doc.deletedAt ? doc.deletedAt.toDate().toISOString() : null,
});

export const toLastSeen = (chatId: string, userId: string, doc: LastSeenDoc): LastSeen => ({
  chatId,
  userId,
  messageId: doc.messageId,
  updatedAt: doc.updatedAt.toDate().toISOString(),
});

/**
 * Same order as the message list: createdAt, then document id as tie-breaker.
 * Returns a negative number if a comes before b.
 */
export const compareMessagePosition = (
  a: { createdAt: Timestamp; id: string },
  b: { createdAt: Timestamp; id: string },
): number => {
  if (!a.createdAt.isEqual(b.createdAt)) {
    return a.createdAt.seconds !== b.createdAt.seconds
      ? a.createdAt.seconds - b.createdAt.seconds
      : a.createdAt.nanoseconds - b.createdAt.nanoseconds;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};
