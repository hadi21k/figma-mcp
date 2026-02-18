import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocket } from "ws";
import { TOOL_REGISTRY } from "./tools.js";
import { RequestTracker, generateRequestId } from "./request-tracker.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const WS_URL = process.env.WS_URL ?? "ws://127.0.0.1:9001?role=mcp-client";
const WS_TIMEOUT_MS = parseInt(process.env.WS_TIMEOUT_MS ?? "30000", 10);
const WS_RECONNECT_INTERVAL_MS = 3000;

// ─── Request Tracker ─────────────────────────────────────────────────────────

const tracker = new RequestTracker(WS_TIMEOUT_MS);

// ─── WebSocket Client ────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
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
        if (msg.success === true && typeof msg.data === "object" && msg.data !== null) {
          tracker.resolve(msg.requestId, msg.data as Record<string, unknown>);
        } else if (msg.success === false && typeof msg.error === "object" && msg.error !== null) {
          const errObj = msg.error as { code?: string; message?: string };
          tracker.reject(
            msg.requestId,
            new Error(`[${errObj.code ?? "UNKNOWN"}] ${errObj.message ?? "Unknown error"}`),
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

async function sendCommand(command: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to bridge. Ensure the WebSocket bridge is running.");
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

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "figma-mcp",
  version: "1.0.0",
});

// Register each tool using the high-level McpServer API.
// McpServer handles Zod → JSON Schema conversion and input validation internally.
for (const [name, def] of Object.entries(TOOL_REGISTRY)) {
  server.registerTool(
    name,
    {
      description: def.description,
      inputSchema: def.inputSchema,
    },
    async (args: Record<string, unknown>) => {
      try {
        const result = await sendCommand(name, args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// ─── Start ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  connectWebSocket();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] Figma MCP server started (stdio)");
}

const isDirectRun = process.argv[1]?.includes("mcp-server/index");
if (isDirectRun) {
  main().catch((err) => {
    console.error("[mcp] Fatal error:", err);
    process.exit(1);
  });
}

export { server, sendCommand, generateRequestId, connectWebSocket, tracker };
