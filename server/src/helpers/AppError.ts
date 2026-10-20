import { status } from "http-status";
import { ZodError } from "zod";

/** An expected error that should reach the client with a specific HTTP status. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string) {
    return new AppError(status.BAD_REQUEST, message);
  }

  static forbidden(message: string) {
    return new AppError(status.FORBIDDEN, message);
  }

  static notFound(message: string) {
    return new AppError(status.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new AppError(status.CONFLICT, message);
  }
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  details?: Record<string, string[]>;
  /** false for bugs/outages that should be logged with a stack trace */
  expected: boolean;
}

/** Maps any thrown value to a client-safe response. Shared by HTTP and sockets. */
export const toErrorResponse = (err: unknown): ErrorResponse => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, expected: true };
  }
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      // Drop the leading "body"/"params"/"query" so clients see the field name.
      const key = issue.path.slice(issue.path.length > 1 ? 1 : 0).join(".") || "input";
      (details[key] ??= []).push(issue.message);
    }
    return { statusCode: status.BAD_REQUEST, message: "Validation failed", details, expected: true };
  }
  // Never leak internal error messages (SQL, credentials, stack) to clients.
  return { statusCode: status.INTERNAL_SERVER_ERROR, message: "Internal server error", expected: false };
};
