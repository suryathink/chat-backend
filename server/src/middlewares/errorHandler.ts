import type { NextFunction, Request, Response } from "express";
import { status } from "http-status";
import { logger } from "../configs/logger";
import { toErrorResponse } from "../helpers/AppError";

// Express recognises error middleware by its 4 arguments, so `next` must stay.
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed") {
    res.status(status.BAD_REQUEST).json({ error: { message: "Malformed JSON body" } });
    return;
  }

  const { statusCode, message, details, expected } = toErrorResponse(err);
  if (!expected) logger.error(`${req.method} ${req.originalUrl} failed:`, err);

  res.status(statusCode).json({ error: { message, ...(details && { details }) } });
};
