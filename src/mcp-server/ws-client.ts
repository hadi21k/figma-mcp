import { WebSocket } from "ws";
import { RequestTracker, generateRequestId } from "./request-tracker.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const WS_URL = process.env.WS_URL ?? "ws://127.0.0.1:9001?role=mcp-client";
const _timeoutRaw = parseInt(process.env.WS_TIMEOUT_MS ?? "30000", 10);
const WS_TIMEOUT_MS = Number.isNaN(_timeoutRaw) ? 30000 : _timeoutRaw;
const WS_RECONNECT_INTERVAL_MS = 3000;

// ─── Request Tracker ─────────────────────────────────────────────────────────

export const tracker = new RequestTracker(WS_TIMEOUT_MS);

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
    console.error("[mcp] Failed to create WebSocket connection");
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    console.error("[mcp] Connected to bridge");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  ws.on("message", (data) => {
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
      console.error("[mcp] Failed to parse bridge message:", err);
    }
  });

  ws.on("close", () => {
    console.error("[mcp] Disconnected from bridge");
    ws = null;
    tracker.rejectAll(new Error("Bridge connection lost"));
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("[mcp] WebSocket error:", err.message);
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
  const message = {
    type: "COMMAND",
    requestId,
    command,
    args,
  };

  const responsePromise = tracker.add(requestId);
  ws.send(JSON.stringify(message));
  return responsePromise;
}
