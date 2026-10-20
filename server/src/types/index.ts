/** Shapes returned by the API and sent over sockets. Dates are ISO-8601 strings. */

export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  memberIds: [string, string];
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  /** userId -> time that user read the message */
  readBy: Record<string, string>;
  /** Set when the sender edited the text. */
  editedAt: string | null;
  /** Set when the sender deleted the message; `text` is then empty. */
  deletedAt: string | null;
}

export interface ReadReceipt {
  chatId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface LastSeen {
  chatId: string;
  userId: string;
  messageId: string;
  updatedAt: string;
}
