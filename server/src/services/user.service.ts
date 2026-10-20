import { randomUUID } from "crypto";
import { AppError } from "../helpers/AppError";
import { UserModel } from "../models/user.model";
import type { User } from "../types";

export const userService = {
  async create(name: string): Promise<User> {
    const id = randomUUID();
    await UserModel.insert(id, name);
    const user = await UserModel.findById(id);
    if (!user) throw new Error(`User ${id} missing right after insert`);
    return user;
  },

  async assertExists(...ids: string[]): Promise<void> {
    const existing = await UserModel.findExistingIds(ids);
    const missing = ids.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw AppError.notFound(`User not found: ${missing.join(", ")}`);
    }
  },
};
