import type { Request, Response } from "express";
import { status } from "http-status";

export const notFound = (req: Request, res: Response) => {
  res.status(status.NOT_FOUND).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
};
