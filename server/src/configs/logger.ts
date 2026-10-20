import log4js from "log4js";
import { env } from "./env";

log4js.configure({
  appenders: { console: { type: "console" } },
  categories: { default: { appenders: ["console"], level: env.LOG_LEVEL } },
});

export const logger = log4js.getLogger("chat-server");
