import type { RowDataPacket } from "mysql2";
import { pool } from "../configs/mysql";
import type { User } from "../types";

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  created_at: Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at.toISOString(),
});

export const UserModel = {
  async insert(id: string, name: string): Promise<void> {
    await pool.execute("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);
  },

  async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, name, created_at FROM users WHERE id = ?",
      [id],
    );
    const row = rows[0];
    return row ? toUser(row) : null;
  },

  /** Returns which of the given ids exist. */
  async findExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT id FROM users WHERE id IN (${placeholders})`,
      ids,
    );
    return new Set(rows.map((row) => row.id));
  },
};
