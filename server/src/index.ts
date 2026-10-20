import http from "http";
import cors from "cors";
import express from "express";
import { env } from "./configs/env";
import { logger } from "./configs/logger";
import { connectMySQL, pool } from "./configs/mysql";
// Imported for its side effect: initialise Firebase at startup so bad
// credentials fail immediately, not on the first message.
import "./configs/firebase";

import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import routes from "./routes";
import { initSockets } from "./sockets";

const corsOrigin = env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map((o) => o.trim());

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use(routes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = initSockets(server, corsOrigin);

const start = async () => {
  await connectMySQL();
  server.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT}`);
  });
};

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  // io.close() also closes the underlying HTTP server.
  io.close(() => {
    pool
      .end()
      .catch((err: unknown) => logger.error("Error closing MySQL pool:", err))
      .finally(() => process.exit(0));
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err: unknown) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
