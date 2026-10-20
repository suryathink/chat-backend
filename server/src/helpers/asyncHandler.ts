import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 does not catch rejected promises, so forward them to the error handler. */
export const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
