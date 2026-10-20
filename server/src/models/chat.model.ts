import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../configs/mysql";
import type { Chat } from "../types";

interface ChatRow extends RowDataPacket {
  id: string;
  user_low_id: string;
  user_high_id: string;
  created_at: Date;
}

const COLUMNS = "id, user_low_id, user_high_id, created_at";

const toChat = (row: ChatRow): Chat => ({
  id: row.id,
  memberIds: [row.user_low_id, row.user_high_id],
  createdAt: row.created_at.toISOString(),
});

export const ChatModel = {
  /**
   * Inserts the chat unless one already exists for this pair.
   * Returns true if a new row was created.
   *
   * ON DUPLICATE KEY UPDATE (not INSERT IGNORE): only a duplicate pair is
   * treated as "already exists"; foreign key or CHECK violations still throw.
   */
  async insertIfAbsent(id: string, userLowId: string, userHighId: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO chats (id, user_low_id, user_high_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [id, userLowId, userHighId],
    );
    // 1 = inserted, 0 = duplicate left unchanged
    return result.affectedRows === 1;
  },

  async findByPair(userLowId: string, userHighId: string): Promise<Chat | null> {
    const [rows] = await pool.execute<ChatRow[]>(
      `SELECT ${COLUMNS} FROM chats WHERE user_low_id = ? AND user_high_id = ?`,
      [userLowId, userHighId],
    );
    const row = rows[0];
    return row ? toChat(row) : null;
  },

  async findById(id: string): Promise<Chat | null> {
    const [rows] = await pool.execute<ChatRow[]>(`SELECT ${COLUMNS} FROM chats WHERE id = ?`, [id]);
    const row = rows[0];
    return row ? toChat(row) : null;
  },

  /**
   * Newest chats first. UNION ALL lets each half use its own index
   * (uq_chats_pair for user_low_id, idx_chats_user_high for user_high_id);
   * a user can't be on both sides of the same chat, so there are no duplicates.
   */
  async findByUserId(userId: string): Promise<Chat[]> {
    const [rows] = await pool.execute<ChatRow[]>(
      `SELECT ${COLUMNS} FROM chats WHERE user_low_id = ?
       UNION ALL
       SELECT ${COLUMNS} FROM chats WHERE user_high_id = ?
       ORDER BY created_at DESC`,
      [userId, userId],
    );
    return rows.map(toChat);
  },
};
