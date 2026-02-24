import {
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
  DEFAULT_TIMEOUT_MS,
  MAX_MESSAGE_BYTES,
} from "../shared/constants.js";
import type { LogLevel } from "../shared/constants.js";

export interface BridgeConfig {
  host: string;
  port: number;
  timeoutMs: number;
  maxMessageBytes: number;
  logLevel: LogLevel;
  logPretty: boolean;
}

export function loadConfig(): BridgeConfig {
  return {
    host: DEFAULT_WS_HOST,
    port: parseInt(process.env.WS_PORT ?? String(DEFAULT_WS_PORT), 10),
    timeoutMs: parseInt(process.env.WS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
    maxMessageBytes: MAX_MESSAGE_BYTES,
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    logPretty: process.env.LOG_PRETTY === "true",
  };
}
