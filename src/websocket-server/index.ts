import { WebSocketServer, WebSocket, RawData } from "ws";
import { IncomingMessage } from "http";
import { URL, fileURLToPath } from "url";
import { BridgeConfig, loadConfig } from "./config.js";
import { ProtocolError, parseAndValidate } from "./validation.js";
import { createLogger, MetricsCollector } from "../shared/logger/index.js";
import type { Logger } from "../shared/logger/index.js";
import type { MetricsSnapshot } from "../shared/logger/index.js";
import type {
  RegisterMessage,
  CommandMessage,
  ErrorResponseMsg,
  WireMessage,
} from "../shared/protocol.js";

// ─── Re-exports for consumers ────────────────────────────────────────────────

export type { BridgeConfig } from "./config.js";
export { loadConfig } from "./config.js";
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
  private mcpClients = new Set<WebSocket>();
  private pluginClient: WebSocket | null = null;
  private requestToClient = new Map<string, WebSocket>();
  private config: BridgeConfig;
  private isPluginRegistered = false;
  private log: Logger;
  private metrics: MetricsCollector;

  constructor(config?: Partial<BridgeConfig>) {
    const defaults = loadConfig();
    this.config = { ...defaults, ...config };
    this.log = createLogger({
      component: "bridge",
      level: this.config.logLevel,
      pretty: this.config.logPretty,
    });
    this.metrics = new MetricsCollector();
  }

  getMetrics(): MetricsSnapshot {
    return this.metrics.snapshot();
  }

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

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
          this.log.info(
            { host: this.config.host, port: this.config.port },
            "bridge listening",
          );
          this.startCleanupInterval();
          this.startPingInterval();
          resolve();
        });

        this.wss.on("error", (err: Error) => {
          this.log.error({ err }, "server error");
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private requestTimestamps = new Map<string, number>();

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = this.config.timeoutMs + 5000;
      for (const [requestId, ts] of this.requestTimestamps) {
        if (now - ts > staleThreshold) {
          this.requestToClient.delete(requestId);
          this.requestTimestamps.delete(requestId);
        }
      }
    }, 60_000);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const client of this.mcpClients) {
        if (client.readyState === WebSocket.OPEN) client.ping();
      }
      if (this.pluginClient?.readyState === WebSocket.OPEN) {
        this.pluginClient.ping();
      }
    }, 30_000);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.cleanupInterval) { clearInterval(this.cleanupInterval); this.cleanupInterval = null; }
      if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
      for (const client of this.mcpClients) {
        client.close(1000, "Bridge shutting down");
      }
      this.mcpClients.clear();
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

    if (this.config.bridgeToken) {
      const token = url.searchParams.get("token");
      if (token !== this.config.bridgeToken) {
        this.log.warn("connection rejected — invalid or missing token");
        ws.close(4000, "Unauthorized");
        return;
      }
    }

    const origin = req.headers.origin;
    if (origin && origin !== "null") {
      this.log.warn({ origin }, "connection rejected — browser origin not allowed");
      ws.close(4000, "Origin not allowed");
      return;
    }

    const role = url.searchParams.get("role");

    if (role === "mcp-client") {
      this.handleMcpClient(ws);
    } else {
      this.handlePotentialPlugin(ws);
    }
  }

  private handleMcpClient(ws: WebSocket): void {
    if (this.mcpClients.size >= this.config.maxMcpClients) {
      this.log.warn("mcp client rejected — max clients reached");
      ws.close(4429, "Too many MCP clients");
      return;
    }
    this.mcpClients.add(ws);
    this.log.info({ mcpClients: this.mcpClients.size }, "mcp client connected");
    this.metrics.recordConnection("mcpConnects");

    ws.on("message", (data: RawData) => {
      this.onMcpClientMessage(ws, data.toString());
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.mcpClients.delete(ws);
      this.log.info(
        { code, reason: reason.toString(), mcpClients: this.mcpClients.size },
        "mcp client disconnected",
      );
      this.metrics.recordConnection("mcpDisconnects");

      for (const [requestId, client] of this.requestToClient) {
        if (client === ws) this.requestToClient.delete(requestId);
      }
    });

    ws.on("error", (err: Error) => {
      this.log.error({ err }, "mcp client error");
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
          this.log.info(
            { pluginId: reg.pluginId, pluginVersion: reg.pluginVersion },
            "plugin registered",
          );
          this.metrics.recordConnection("pluginRegistrations");

          return;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.log.warn({ error: errMsg }, "plugin registration failed");
          ws.close(4003, "Protocol error");
          return;
        }
      }

      this.onPluginMessage(raw);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      if (this.pluginClient === ws) {
        this.log.info(
          { code, reason: reason.toString() },
          "plugin disconnected",
        );
        this.metrics.recordConnection("pluginDisconnects");
        this.onPluginDisconnect();
      }
    });

    ws.on("error", (err: Error) => {
      this.log.error({ err }, "plugin error");
    });
  }

  private onMcpClientMessage(sender: WebSocket, raw: string): void {
    let msg: WireMessage;
    try {
      msg = parseAndValidate(raw);
    } catch (err) {
      this.log.warn(
        { error: (err as Error).message },
        "invalid message from mcp client",
      );
      return;
    }

    if (msg.type !== "COMMAND") {
      this.log.warn(
        { messageType: msg.type },
        "non-command from mcp client",
      );
      return;
    }

    const cmdMsg = msg as CommandMessage;
    const reqLog = this.log.child({ requestId: msg.requestId });

    this.metrics.recordMessageIn();

    if (!this.pluginClient || this.pluginClient.readyState !== WebSocket.OPEN) {
      reqLog.warn("plugin not connected, returning error");
      this.metrics.recordError("PLUGIN_DISCONNECTED");
      const errorResponse: ErrorResponseMsg = {
        type: "RESPONSE",
        requestId: msg.requestId,
        success: false,
        error: {
          code: "PLUGIN_DISCONNECTED",
          message: "Figma plugin is not connected to the bridge.",
        },
      };
      if (sender.readyState === WebSocket.OPEN) {
        sender.send(JSON.stringify(errorResponse));
      }
      return;
    }

    reqLog.debug({ command: cmdMsg.command }, "routing command to plugin");
    this.requestToClient.set(msg.requestId, sender);
    this.requestTimestamps.set(msg.requestId, Date.now());
    this.pluginClient.send(raw);
  }

  private onPluginMessage(raw: string): void {
    let msg: WireMessage;
    try {
      msg = parseAndValidate(raw);
    } catch (err) {
      this.log.warn(
        { error: (err as Error).message },
        "invalid message from plugin",
      );
      return;
    }

    if (msg.type !== "RESPONSE") {
      this.log.warn(
        { messageType: msg.type },
        "non-response from plugin",
      );
      return;
    }

    const sender = this.requestToClient.get(msg.requestId);
    this.requestToClient.delete(msg.requestId);
    this.requestTimestamps.delete(msg.requestId);
    this.metrics.recordMessageOut();

    if (sender && sender.readyState === WebSocket.OPEN) {
      sender.send(raw);
    }
  }

  private onPluginDisconnect(): void {
    this.pluginClient = null;
    this.isPluginRegistered = false;

    for (const [requestId, client] of this.requestToClient) {
      this.log.warn({ requestId }, "rejecting pending request after plugin disconnect");
      this.metrics.recordError("PLUGIN_DISCONNECTED");
      const errorResponse: ErrorResponseMsg = {
        type: "RESPONSE",
        requestId,
        success: false,
        error: {
          code: "PLUGIN_DISCONNECTED",
          message: "Figma plugin disconnected before responding.",
        },
      };
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(errorResponse));
      }
    }
    this.requestToClient.clear();
    this.requestTimestamps.clear();
  }

  get isReady(): boolean {
    return (
      this.mcpClients.size > 0 &&
      this.pluginClient !== null &&
      this.pluginClient.readyState === WebSocket.OPEN &&
      this.isPluginRegistered
    );
  }

  get pendingCount(): number {
    return this.requestToClient.size;
  }

  get mcpClientCount(): number {
    return this.mcpClients.size;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const bridge = new FigmaBridge();
  const log = createLogger({ component: "bridge" });

  bridge
    .start()
    .then(() => {
      log.info("server running, press Ctrl+C to stop");
    })
    .catch((err) => {
      log.fatal({ err }, "failed to start");
      process.exit(1);
    });

  process.on("SIGINT", async () => {
    log.info("shutting down (SIGINT)");
    log.info({ metrics: bridge.getMetrics() }, "final metrics snapshot");
    await bridge.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log.info("shutting down (SIGTERM)");
    log.info({ metrics: bridge.getMetrics() }, "final metrics snapshot");
    await bridge.stop();
    process.exit(0);
  });
}
