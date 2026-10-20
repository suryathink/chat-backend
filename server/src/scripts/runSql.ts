/**
 * Runs every .sql file in a folder, in filename order.
 * Usage: node dist/scripts/runSql.js db/migrations
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { env } from "../configs/env";

const run = async () => {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: runSql <folder>");

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: true,
  });

  try {
    for (const file of files) {
      await connection.query(fs.readFileSync(path.join(dir, file), "utf8"));
      console.log(`ran ${file}`);
    }
  } finally {
    await connection.end();
  }
};

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
