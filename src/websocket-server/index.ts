import { WebSocketServer, WebSocket, RawData } from "ws";
import { IncomingMessage } from "http";
import { URL, fileURLToPath } from "url";
import { BridgeConfig, loadConfig } from "./config.js";
import { ProtocolError, parseAndValidate } from "./validation.js";
import type {
  RegisterMessage,
  ErrorResponseMsg,
  WireMessage,
} from "../shared/protocol.js";

// ─── Re-exports for consumers ────────────────────────────────────────────────

export { BridgeConfig, loadConfig } from "./config.js";
export { ProtocolError, parseAndValidate } from "./validation.js";
export type {
  ErrorCode,
  RegisterMessage,
  CommandMessage,
  SuccessResponse,
  ErrorResponseMsg,
  ResponseMessage,
  WireMessage,
} from "../shared/protocol.js";

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

          return;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("[bridge] Plugin registration failed:", errMsg);
          ws.close(4003, "Protocol error");
          return;
        }
      }

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
