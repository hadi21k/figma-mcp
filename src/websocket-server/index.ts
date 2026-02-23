import { WebSocketServer, WebSocket, RawData } from "ws";
import { IncomingMessage } from "http";
import { URL, fileURLToPath } from "url";

// ─── Configuration ───────────────────────────────────────────────────────────

export interface BridgeConfig {
  host: string;
  port: number;
  timeoutMs: number;
  maxMessageBytes: number;
}

export function loadConfig(): BridgeConfig {
  return {
    host: "127.0.0.1",
    port: parseInt(process.env.WS_PORT ?? "9001", 10),
    timeoutMs: parseInt(process.env.WS_TIMEOUT_MS ?? "30000", 10),
    maxMessageBytes: 65_536,
  };
}

// ─── Protocol Types ──────────────────────────────────────────────────────────

export type ErrorCode =
  | "NODE_NOT_FOUND"
  | "INVALID_ARGS"
  | "COMMAND_NOT_FOUND"
  | "PLUGIN_DISCONNECTED"
  | "TIMEOUT"
  | "EXECUTION_ERROR"
  | "FONT_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface RegisterMessage {
  type: "REGISTER";
  requestId: string;
  pluginId: string;
  pluginVersion: string;
}

export interface CommandMessage {
  type: "COMMAND";
  requestId: string;
  command: string;
  args: Record<string, unknown>;
}

export interface SuccessResponse {
  type: "RESPONSE";
  requestId: string;
  success: true;
  data: Record<string, unknown>;
}

export interface ErrorResponseMsg {
  type: "RESPONSE";
  requestId: string;
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ResponseMessage = SuccessResponse | ErrorResponseMsg;
export type WireMessage = RegisterMessage | CommandMessage | ResponseMessage;

const REQUEST_ID_PATTERN = /^req_\d+_[a-z0-9]+$/;

// ─── Message Validation ──────────────────────────────────────────────────────

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

export function parseAndValidate(raw: string): WireMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProtocolError("Invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ProtocolError("Message must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (!["REGISTER", "COMMAND", "RESPONSE"].includes(obj.type as string)) {
    throw new ProtocolError(`Unknown message type: ${String(obj.type)}`);
  }

  if (
    typeof obj.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(obj.requestId)
  ) {
    throw new ProtocolError(`Invalid requestId: ${String(obj.requestId)}`);
  }

  switch (obj.type) {
    case "REGISTER":
      if (typeof obj.pluginId !== "string" || obj.pluginId.length === 0) {
        throw new ProtocolError("REGISTER requires non-empty pluginId");
      }
      if (
        typeof obj.pluginVersion !== "string" ||
        obj.pluginVersion.length === 0
      ) {
        throw new ProtocolError("REGISTER requires non-empty pluginVersion");
      }
      break;
    case "COMMAND":
      if (typeof obj.command !== "string" || obj.command.length === 0) {
        throw new ProtocolError("COMMAND requires non-empty command string");
      }
      if (
        typeof obj.args !== "object" ||
        obj.args === null ||
        Array.isArray(obj.args)
      ) {
        throw new ProtocolError("COMMAND requires args object");
      }
      break;
    case "RESPONSE":
      if (typeof obj.success !== "boolean") {
        throw new ProtocolError("RESPONSE requires success boolean");
      }
      if (obj.success && (typeof obj.data !== "object" || obj.data === null)) {
        throw new ProtocolError("Success RESPONSE requires data object");
      }
      if (
        !obj.success &&
        (typeof obj.error !== "object" || obj.error === null)
      ) {
        throw new ProtocolError("Error RESPONSE requires error object");
      }
      break;
  }

  return obj as unknown as WireMessage;
}

// ─── Bridge Server ───────────────────────────────────────────────────────────

export class FigmaBridge {
  private wss: WebSocketServer | null = null;
  private mcpClient: WebSocket | null = null;
  private pluginClient: WebSocket | null = null;
  private forwardedRequests = new Set<string>();
  private config: BridgeConfig;
  private isPluginRegistered = false;

  constructor(config?: Partial<BridgeConfig>) {
    const defaults = loadConfig();
    this.config = { ...defaults, ...config };
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          host: this.config.host,
          port: this.config.port,
          maxPayload: this.config.maxMessageBytes,
        });

        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req);
        });

        this.wss.on("listening", () => {
          console.log(
            `[bridge] Listening on ${this.config.host}:${this.config.port}`,
          );
          resolve();
        });

        this.wss.on("error", (err: Error) => {
          console.error("[bridge] Server error:", err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.mcpClient) {
        this.mcpClient.close(1000, "Bridge shutting down");
        this.mcpClient = null;
      }
      if (this.pluginClient) {
        this.pluginClient.close(1000, "Bridge shutting down");
        this.pluginClient = null;
      }
      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const role = url.searchParams.get("role");

    if (role === "mcp-client") {
      this.handleMcpClient(ws);
    } else {
      // Treat as potential plugin — must send REGISTER as first message
      this.handlePotentialPlugin(ws);
    }
  }

  private handleMcpClient(ws: WebSocket): void {
    if (this.mcpClient && this.mcpClient.readyState === WebSocket.OPEN) {
      this.mcpClient.close(4002, "Replaced by new connection");
    }

    this.mcpClient = ws;
    console.log("[bridge] MCP client connected");

    ws.on("message", (data: RawData) => {
      this.onMcpClientMessage(data.toString());
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(
        `[bridge] MCP client disconnected: ${code} ${reason.toString()}`,
      );
      if (this.mcpClient === ws) {
        this.mcpClient = null;
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[bridge] MCP client error:", err.message);
    });
  }

  private handlePotentialPlugin(ws: WebSocket): void {
    let firstMessage = true;

    ws.on("message", (data: RawData) => {
      const raw = data.toString();

      if (firstMessage) {
        firstMessage = false;
        try {
          const msg = parseAndValidate(raw);
          if (msg.type !== "REGISTER") {
            ws.close(4001, "First message must be REGISTER");
            return;
          }

          // Register this as the plugin client
          if (
            this.pluginClient &&
            this.pluginClient.readyState === WebSocket.OPEN
          ) {
            this.pluginClient.close(4002, "Replaced by new connection");
          }

          this.pluginClient = ws;
          this.isPluginRegistered = true;
          const reg = msg as RegisterMessage;
          console.log(
            `[bridge] Plugin registered: ${reg.pluginId} v${reg.pluginVersion}`,
          );

          // Set up plugin message handler for subsequent messages
          return;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("[bridge] Plugin registration failed:", errMsg);
          ws.close(4003, "Protocol error");
          return;
        }
      }

      // Subsequent messages from plugin
      this.onPluginMessage(raw);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      if (this.pluginClient === ws) {
        console.log(
          `[bridge] Plugin disconnected: ${code} ${reason.toString()}`,
        );
        this.onPluginDisconnect();
      }
    });

    ws.on("error", (err: Error) => {
      console.error("[bridge] Plugin error:", err.message);
    });
  }

  private onMcpClientMessage(raw: string): void {
    let msg: WireMessage;
    try {
      msg = parseAndValidate(raw);
    } catch (err) {
      console.error(
        "[bridge] Invalid message from MCP client:",
        (err as Error).message,
      );
      return;
    }

    if (msg.type !== "COMMAND") {
      console.warn(`[bridge] MCP client sent non-COMMAND message: ${msg.type}`);
      return;
    }

    if (!this.pluginClient || this.pluginClient.readyState !== WebSocket.OPEN) {
      const errorResponse: ErrorResponseMsg = {
        type: "RESPONSE",
        requestId: msg.requestId,
        success: false,
        error: {
          code: "PLUGIN_DISCONNECTED",
          message: "Figma plugin is not connected to the bridge.",
        },
      };
      if (this.mcpClient && this.mcpClient.readyState === WebSocket.OPEN) {
        this.mcpClient.send(JSON.stringify(errorResponse));
      }
      return;
    }

    this.forwardedRequests.add(msg.requestId);
    this.pluginClient.send(raw);
  }

  private onPluginMessage(raw: string): void {
    let msg: WireMessage;
    try {
      msg = parseAndValidate(raw);
    } catch (err) {
      console.error(
        "[bridge] Invalid message from plugin:",
        (err as Error).message,
      );
      return;
    }

    if (msg.type !== "RESPONSE") {
      console.warn(`[bridge] Plugin sent non-RESPONSE message: ${msg.type}`);
      return;
    }

    this.forwardedRequests.delete(msg.requestId);

    if (this.mcpClient && this.mcpClient.readyState === WebSocket.OPEN) {
      this.mcpClient.send(raw);
    }
  }

  private onPluginDisconnect(): void {
    this.pluginClient = null;
    this.isPluginRegistered = false;

    if (this.mcpClient && this.mcpClient.readyState === WebSocket.OPEN) {
      for (const requestId of this.forwardedRequests) {
        const errorResponse: ErrorResponseMsg = {
          type: "RESPONSE",
          requestId,
          success: false,
          error: {
            code: "PLUGIN_DISCONNECTED",
            message: "Figma plugin disconnected before responding.",
          },
        };
        this.mcpClient.send(JSON.stringify(errorResponse));
      }
    }
    this.forwardedRequests.clear();
  }

  get isReady(): boolean {
    return (
      this.mcpClient !== null &&
      this.mcpClient.readyState === WebSocket.OPEN &&
      this.pluginClient !== null &&
      this.pluginClient.readyState === WebSocket.OPEN &&
      this.isPluginRegistered
    );
  }

  get pendingCount(): number {
    return this.forwardedRequests.size;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const bridge = new FigmaBridge();

  bridge
    .start()
    .catch((err) => {
      console.error("[bridge] Failed to start:", err);
      process.exit(1);
    })
    .then(() => {
      // Keep the process alive
      console.log("[bridge] Server running. Press Ctrl+C to stop.");
    });

  process.on("SIGINT", async () => {
    console.log("\n[bridge] Shutting down...");
    await bridge.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("[bridge] Shutting down...");
    await bridge.stop();
    process.exit(0);
  });
}
