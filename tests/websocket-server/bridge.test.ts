import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import {
  FigmaBridge,
  parseAndValidate,
  ProtocolError,
} from "../../src/websocket-server/index.js";
import type {
  CommandMessage,
  RegisterMessage,
  ResponseMessage,
  ErrorResponseMsg,
  WireMessage,
} from "../../src/websocket-server/index.js";

// ─── parseAndValidate Tests ──────────────────────────────────────────────────

describe("parseAndValidate", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseAndValidate("not json")).toThrow(ProtocolError);
    expect(() => parseAndValidate("not json")).toThrow("Invalid JSON");
  });

  it("rejects non-object messages", () => {
    expect(() => parseAndValidate('"string"')).toThrow("Message must be a JSON object");
    expect(() => parseAndValidate("42")).toThrow("Message must be a JSON object");
    expect(() => parseAndValidate("null")).toThrow("Message must be a JSON object");
    expect(() => parseAndValidate("[]")).toThrow("Message must be a JSON object");
  });

  it("rejects unknown message type", () => {
    const msg = JSON.stringify({ type: "UNKNOWN", requestId: "req_1_abc123" });
    expect(() => parseAndValidate(msg)).toThrow("Unknown message type");
  });

  it("rejects invalid requestId format", () => {
    const msg = JSON.stringify({ type: "COMMAND", requestId: "bad-id", command: "test", args: {} });
    expect(() => parseAndValidate(msg)).toThrow("Invalid requestId");
  });

  it("rejects requestId that does not match pattern", () => {
    const msg = JSON.stringify({ type: "COMMAND", requestId: "req_1_ABC", command: "test", args: {} });
    expect(() => parseAndValidate(msg)).toThrow("Invalid requestId");
  });

  it("parses valid REGISTER message", () => {
    const msg = JSON.stringify({
      type: "REGISTER",
      requestId: "req_1_abc123",
      pluginId: "figma-mcp-plugin",
      pluginVersion: "1.0.0",
    });
    const result = parseAndValidate(msg);
    expect(result.type).toBe("REGISTER");
    expect((result as RegisterMessage).pluginId).toBe("figma-mcp-plugin");
  });

  it("rejects REGISTER with missing pluginId", () => {
    const msg = JSON.stringify({
      type: "REGISTER",
      requestId: "req_1_abc123",
      pluginVersion: "1.0.0",
    });
    expect(() => parseAndValidate(msg)).toThrow("pluginId");
  });

  it("rejects REGISTER with empty pluginId", () => {
    const msg = JSON.stringify({
      type: "REGISTER",
      requestId: "req_1_abc123",
      pluginId: "",
      pluginVersion: "1.0.0",
    });
    expect(() => parseAndValidate(msg)).toThrow("pluginId");
  });

  it("parses valid COMMAND message", () => {
    const msg = JSON.stringify({
      type: "COMMAND",
      requestId: "req_1_abc123",
      command: "create_frame",
      args: { name: "Test", width: 100, height: 100 },
    });
    const result = parseAndValidate(msg);
    expect(result.type).toBe("COMMAND");
    expect((result as CommandMessage).command).toBe("create_frame");
  });

  it("rejects COMMAND with empty command", () => {
    const msg = JSON.stringify({
      type: "COMMAND",
      requestId: "req_1_abc123",
      command: "",
      args: {},
    });
    expect(() => parseAndValidate(msg)).toThrow("command");
  });

  it("rejects COMMAND with non-object args", () => {
    const msg = JSON.stringify({
      type: "COMMAND",
      requestId: "req_1_abc123",
      command: "test",
      args: "not-object",
    });
    expect(() => parseAndValidate(msg)).toThrow("args");
  });

  it("rejects COMMAND with array args", () => {
    const msg = JSON.stringify({
      type: "COMMAND",
      requestId: "req_1_abc123",
      command: "test",
      args: [],
    });
    expect(() => parseAndValidate(msg)).toThrow("args");
  });

  it("parses valid success RESPONSE", () => {
    const msg = JSON.stringify({
      type: "RESPONSE",
      requestId: "req_1_abc123",
      success: true,
      data: { nodeId: "123:456" },
    });
    const result = parseAndValidate(msg);
    expect(result.type).toBe("RESPONSE");
    expect((result as ResponseMessage).success).toBe(true);
  });

  it("parses valid error RESPONSE", () => {
    const msg = JSON.stringify({
      type: "RESPONSE",
      requestId: "req_1_abc123",
      success: false,
      error: { code: "NODE_NOT_FOUND", message: "Not found" },
    });
    const result = parseAndValidate(msg);
    expect(result.type).toBe("RESPONSE");
    expect((result as ErrorResponseMsg).success).toBe(false);
  });

  it("rejects RESPONSE without success field", () => {
    const msg = JSON.stringify({
      type: "RESPONSE",
      requestId: "req_1_abc123",
      data: {},
    });
    expect(() => parseAndValidate(msg)).toThrow("success");
  });

  it("rejects success RESPONSE without data", () => {
    const msg = JSON.stringify({
      type: "RESPONSE",
      requestId: "req_1_abc123",
      success: true,
    });
    expect(() => parseAndValidate(msg)).toThrow("data");
  });

  it("rejects error RESPONSE without error", () => {
    const msg = JSON.stringify({
      type: "RESPONSE",
      requestId: "req_1_abc123",
      success: false,
    });
    expect(() => parseAndValidate(msg)).toThrow("error");
  });
});

// ─── FigmaBridge Integration Tests ───────────────────────────────────────────

describe("FigmaBridge", () => {
  let bridge: FigmaBridge;
  const TEST_PORT = 19001 + Math.floor(Math.random() * 1000);

  beforeEach(async () => {
    bridge = new FigmaBridge({ host: "127.0.0.1", port: TEST_PORT, timeoutMs: 5000 });
    await bridge.start();
  });

  afterEach(async () => {
    await bridge.stop();
  });

  function connectMcpClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}?role=mcp-client`);
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
  }

  function connectPlugin(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
      ws.on("open", () => {
        // Send REGISTER
        ws.send(JSON.stringify({
          type: "REGISTER",
          requestId: "req_0_register",
          pluginId: "test-plugin",
          pluginVersion: "1.0.0",
        }));
        // Give bridge time to process REGISTER
        setTimeout(() => resolve(ws), 50);
      });
      ws.on("error", reject);
    });
  }

  function waitForMessage(ws: WebSocket): Promise<WireMessage> {
    return new Promise((resolve) => {
      ws.once("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  it("accepts MCP client connection", async () => {
    const client = await connectMcpClient();
    expect(client.readyState).toBe(WebSocket.OPEN);
    client.close();
  });

  it("accepts plugin connection with REGISTER", async () => {
    const plugin = await connectPlugin();
    expect(plugin.readyState).toBe(WebSocket.OPEN);
    plugin.close();
  });

  it("closes plugin that does not send REGISTER first", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        // Send a COMMAND instead of REGISTER
        ws.send(JSON.stringify({
          type: "COMMAND",
          requestId: "req_1_abc123",
          command: "test",
          args: {},
        }));
      });
      ws.on("close", (code) => {
        expect(code).toBe(4001);
        resolve();
      });
    });
  });

  it("routes COMMAND from MCP client to plugin", async () => {
    const plugin = await connectPlugin();
    const mcpClient = await connectMcpClient();

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_1_abc123",
      command: "create_frame",
      args: { name: "Test", width: 100, height: 100 },
    };

    const msgPromise = waitForMessage(plugin);
    mcpClient.send(JSON.stringify(commandMsg));
    const received = await msgPromise;

    expect(received.type).toBe("COMMAND");
    expect((received as CommandMessage).command).toBe("create_frame");

    mcpClient.close();
    plugin.close();
  });

  it("routes RESPONSE from plugin to MCP client", async () => {
    const plugin = await connectPlugin();
    const mcpClient = await connectMcpClient();

    // MCP client sends command
    const commandMsg = {
      type: "COMMAND",
      requestId: "req_2_xyz789",
      command: "get_selection",
      args: {},
    };

    const pluginMsgPromise = waitForMessage(plugin);
    mcpClient.send(JSON.stringify(commandMsg));
    await pluginMsgPromise;

    // Plugin sends response
    const responseMsg = {
      type: "RESPONSE",
      requestId: "req_2_xyz789",
      success: true,
      data: { selectionCount: 0, nodes: [] },
    };

    const mcpMsgPromise = waitForMessage(mcpClient);
    plugin.send(JSON.stringify(responseMsg));
    const received = await mcpMsgPromise;

    expect(received.type).toBe("RESPONSE");
    expect((received as ResponseMessage).success).toBe(true);

    mcpClient.close();
    plugin.close();
  });

  it("returns PLUGIN_DISCONNECTED when plugin is not connected", async () => {
    const mcpClient = await connectMcpClient();

    // No plugin connected — send command
    const commandMsg = {
      type: "COMMAND",
      requestId: "req_3_aaa111",
      command: "create_frame",
      args: { name: "Test" },
    };

    const msgPromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const received = await msgPromise;

    expect(received.type).toBe("RESPONSE");
    expect((received as ErrorResponseMsg).success).toBe(false);
    expect((received as ErrorResponseMsg).error.code).toBe("PLUGIN_DISCONNECTED");

    mcpClient.close();
  });

  it("sends PLUGIN_DISCONNECTED for pending requests when plugin disconnects", async () => {
    const plugin = await connectPlugin();
    const mcpClient = await connectMcpClient();

    // Send command
    const commandMsg = {
      type: "COMMAND",
      requestId: "req_4_bbb222",
      command: "create_frame",
      args: { name: "Test" },
    };

    const pluginMsgPromise = waitForMessage(plugin);
    mcpClient.send(JSON.stringify(commandMsg));
    await pluginMsgPromise;

    // Disconnect plugin before responding
    const mcpMsgPromise = waitForMessage(mcpClient);
    plugin.close();
    const received = await mcpMsgPromise;

    expect(received.type).toBe("RESPONSE");
    expect((received as ErrorResponseMsg).success).toBe(false);
    expect((received as ErrorResponseMsg).error.code).toBe("PLUGIN_DISCONNECTED");

    mcpClient.close();
  });

  it("replaces old MCP client on new connection", async () => {
    const oldClient = await connectMcpClient();

    const closePromise = new Promise<number>((resolve) => {
      oldClient.on("close", (code) => resolve(code));
    });

    const newClient = await connectMcpClient();
    const code = await closePromise;
    expect(code).toBe(4002);

    newClient.close();
  });

  it("replaces old plugin on new REGISTER", async () => {
    const oldPlugin = await connectPlugin();

    const closePromise = new Promise<number>((resolve) => {
      oldPlugin.on("close", (code) => resolve(code));
    });

    const newPlugin = await connectPlugin();
    const code = await closePromise;
    expect(code).toBe(4002);

    newPlugin.close();
  });

  it("ignores non-COMMAND messages from MCP client", async () => {
    const mcpClient = await connectMcpClient();

    // Send a RESPONSE message from MCP client (invalid direction)
    const msg = {
      type: "RESPONSE",
      requestId: "req_5_ccc333",
      success: true,
      data: {},
    };
    mcpClient.send(JSON.stringify(msg));

    // No crash — give time for processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mcpClient.readyState).toBe(WebSocket.OPEN);

    mcpClient.close();
  });

  it("tracks pending request count correctly", async () => {
    expect(bridge.pendingCount).toBe(0);

    const plugin = await connectPlugin();
    const mcpClient = await connectMcpClient();

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_6_ddd444",
      command: "get_node",
      args: { nodeId: "123:456" },
    };

    const pluginMsgPromise = waitForMessage(plugin);
    mcpClient.send(JSON.stringify(commandMsg));
    await pluginMsgPromise;

    // Wait for bridge to process
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bridge.pendingCount).toBe(1);

    // Plugin responds
    const responseMsg = {
      type: "RESPONSE",
      requestId: "req_6_ddd444",
      success: true,
      data: { id: "123:456", name: "Test" },
    };
    plugin.send(JSON.stringify(responseMsg));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bridge.pendingCount).toBe(0);

    mcpClient.close();
    plugin.close();
  });
});
