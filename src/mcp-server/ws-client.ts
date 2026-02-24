import { WebSocket } from "ws";
import { RequestTracker, generateRequestId } from "./request-tracker.js";
import { createLogger } from "../shared/logger/index.js";

// ─── Logging ─────────────────────────────────────────────────────────────────

const log = createLogger({ component: "mcp" });

// ─── Configuration ───────────────────────────────────────────────────────────

const WS_URL = process.env.WS_URL ?? "ws://127.0.0.1:9001?role=mcp-client";
const _timeoutRaw = parseInt(process.env.WS_TIMEOUT_MS ?? "30000", 10);
const WS_TIMEOUT_MS = Number.isNaN(_timeoutRaw) ? 30000 : _timeoutRaw;
const WS_RECONNECT_INTERVAL_MS = 3000;

// ─── Request Tracker ─────────────────────────────────────────────────────────

export const tracker = new RequestTracker(WS_TIMEOUT_MS, log);

// ─── WebSocket Client ────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectWebSocket(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    log.error("failed to create websocket connection");
    scheduleReconnect();
    return;
  }

  const socket = ws;

  socket.on("open", () => {
    log.info({ url: WS_URL }, "connected to bridge");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  socket.on("message", (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw) as Record<string, unknown>;

      if (msg.type === "RESPONSE" && typeof msg.requestId === "string") {
        if (
          msg.success === true &&
          typeof msg.data === "object" &&
          msg.data !== null
        ) {
          tracker.resolve(msg.requestId, msg.data as Record<string, unknown>);
        } else if (
          msg.success === false &&
          typeof msg.error === "object" &&
          msg.error !== null
        ) {
          const errObj = msg.error as { code?: string; message?: string };
          tracker.reject(
            msg.requestId,
            new Error(
              `[${errObj.code ?? "UNKNOWN"}] ${errObj.message ?? "Unknown error"}`,
            ),
          );
        }
      }
    } catch (err) {
      log.error({ err }, "failed to parse bridge message");
    }
  });

  socket.on("close", (code: number, reason: Buffer) => {
    if (ws === socket) ws = null;
    tracker.rejectAll(new Error("Bridge connection lost"));
    log.warn({ code, reason: reason.toString() }, "disconnected from bridge");
    scheduleReconnect();
  });

  socket.on("error", (err) => {
    log.error({ err }, "websocket error");
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, WS_RECONNECT_INTERVAL_MS);
}

export async function sendCommand(
  command: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error(
      "Not connected to bridge. Ensure the WebSocket bridge is running.",
    );
  }

  const requestId = generateRequestId();
  const reqLog = log.child({ requestId, command });
  const message = {
    type: "COMMAND",
    requestId,
    command,
    args,
  };

  reqLog.debug("sending command to bridge");
  const responsePromise = tracker.add(requestId);
  ws.send(JSON.stringify(message));
  return responsePromise;
}
