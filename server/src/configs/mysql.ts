import mysql from "mysql2/promise";
import { env } from "./env";
import { logger } from "./logger";

export const pool = mysql.createPool({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  connectionLimit: 10,
  // Read DATETIME values as UTC so timestamps don't shift with the server's timezone.
  timezone: "Z",
});

// Make CURRENT_TIMESTAMP defaults write UTC too.
pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export const connectMySQL = async (): Promise<void> => {
  await pool.query("SELECT 1");
  logger.info(`MySQL connected (${env.MYSQL_HOST}:${env.MYSQL_PORT}/${env.MYSQL_DATABASE})`);
};
