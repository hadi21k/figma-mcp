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
  bridgeToken: string | undefined;
  maxMcpClients: number;
}

export function loadConfig(): BridgeConfig {
  const port = parseInt(process.env.WS_PORT ?? String(DEFAULT_WS_PORT), 10);
  const timeoutMs = parseInt(process.env.WS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
  if (Number.isNaN(port)) throw new Error(`Invalid WS_PORT: ${process.env.WS_PORT}`);
  if (Number.isNaN(timeoutMs)) throw new Error(`Invalid WS_TIMEOUT_MS: ${process.env.WS_TIMEOUT_MS}`);
  return {
    host: DEFAULT_WS_HOST,
    port,
    timeoutMs,
    maxMessageBytes: MAX_MESSAGE_BYTES,
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    logPretty: process.env.LOG_PRETTY === "true",
    bridgeToken: process.env.BRIDGE_TOKEN || undefined,
    maxMcpClients: 5,
  };
}
