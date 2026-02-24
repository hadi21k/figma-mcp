import pino, { type Logger, type LoggerOptions } from "pino";
import { REDACT_PATHS, REDACT_CENSOR } from "./redact.js";

export interface LogConfig {
  component: string;
  level?: string;
  pretty?: boolean;
  /** fd number (2=stderr) or absolute file path */
  destination?: number | string;
}

export function createLogger(config: LogConfig): Logger {
  const level = config.level ?? process.env.LOG_LEVEL ?? "info";

  const pretty =
    config.pretty ??
    (process.env.LOG_PRETTY === "true" ||
      process.env.NODE_ENV === "development");

  // LOG_FILE env var writes to a file; otherwise default to stderr (fd 2)
  const destination: number | string =
    config.destination ?? process.env.LOG_FILE ?? 2;

  const options: LoggerOptions = {
    level,
    name: config.component,
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACT_CENSOR,
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  };

  if (pretty) {
    try {
      const transport = pino.transport({
        target: "pino-pretty",
        options: {
          destination,
          colorize: typeof destination === "number",
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      });
      return pino(options, transport);
    } catch {
      // pino-pretty not installed — fall through to JSON
    }
  }

  return pino(
    options,
    typeof destination === "number"
      ? pino.destination({ dest: destination, sync: false })
      : pino.destination({ dest: destination, sync: false, append: true }),
  );
}

export type { Logger } from "pino";
