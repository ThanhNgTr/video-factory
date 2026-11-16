import { pino } from "pino";

export type Logger = ReturnType<typeof pino>;
export const createLogger = (level = "info"): Logger =>
  pino({ level, base: undefined, redact: ["apiKey", "*.apiKey", "authorization"] });
