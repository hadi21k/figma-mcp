import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { FigmaBridge } from "../../src/websocket-server/index.js";
import type {
  CommandMessage,
  ResponseMessage,
  ErrorResponseMsg,
  WireMessage,
} from "../../src/websocket-server/index.js";

/**
 * Integration tests: Full round-trip from mock MCP client through bridge to mock plugin and back.
 * Does NOT require Figma Desktop — the "plugin" is a mock WebSocket client that simulates responses.
 */

describe("Full Round-Trip Integration", () => {
  let bridge: FigmaBridge;
  const TEST_PORT = 20001 + Math.floor(Math.random() * 1000);

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

  function connectMockPlugin(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "REGISTER",
          requestId: "req_0_register",
          pluginId: "mock-plugin",
          pluginVersion: "1.0.0",
        }));
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

  /**
   * Sets up a mock plugin that automatically responds to commands.
   * Simulates the Figma plugin's behavior without Figma Desktop.
   */
  function setupAutoRespondPlugin(plugin: WebSocket): void {
    plugin.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as WireMessage;
      if (msg.type !== "COMMAND") return;

      const cmd = msg as CommandMessage;
      let responseData: Record<string, unknown>;

      switch (cmd.command) {
        case "create_frame":
          responseData = {
            nodeId: "100:1",
            name: cmd.args.name ?? "Frame",
            type: "FRAME",
          };
          break;
        case "create_rectangle":
          responseData = {
            nodeId: "100:2",
            name: cmd.args.name ?? "Rectangle",
            type: "RECTANGLE",
          };
          break;
        case "create_text":
          responseData = {
            nodeId: "100:3",
            name: cmd.args.name ?? "Text",
            type: "TEXT",
            characters: cmd.args.content ?? "",
          };
          break;
        case "get_document_info":
          responseData = {
            documentName: "Test Document",
            pages: [{ id: "0:1", name: "Page 1", frames: [] }],
            currentPageId: "0:1",
            currentPageName: "Page 1",
          };
          break;
        case "get_selection":
          responseData = { selectionCount: 0, nodes: [] };
          break;
        case "get_node":
          responseData = {
            id: cmd.args.nodeId,
            name: "Test Node",
            type: "FRAME",
            x: 0, y: 0, width: 100, height: 100,
            visible: true, opacity: 1,
            fills: [], strokes: [],
          };
          break;
        case "delete_node":
          responseData = { deleted: true, nodeId: cmd.args.nodeId };
          break;
        case "zoom_to_node":
          responseData = {
            nodeId: cmd.args.nodeId,
            viewport: { x: 50, y: 50, zoom: 1 },
          };
          break;
        default:
          responseData = { success: true };
      }

      plugin.send(JSON.stringify({
        type: "RESPONSE",
        requestId: cmd.requestId,
        success: true,
        data: responseData,
      }));
    });
  }

  it("completes full round-trip for create_frame", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_1_test01",
      command: "create_frame",
      args: { name: "Hero Section", width: 1440, height: 900, x: 0, y: 0 },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ResponseMessage;
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.nodeId).toBe("100:1");
      expect(resp.data.name).toBe("Hero Section");
      expect(resp.data.type).toBe("FRAME");
    }

    mcpClient.close();
    plugin.close();
  });

  it("completes full round-trip for create_rectangle", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_2_test02",
      command: "create_rectangle",
      args: { name: "Card", width: 300, height: 200, cornerRadius: 12 },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    expect((response as ResponseMessage).success).toBe(true);

    mcpClient.close();
    plugin.close();
  });

  it("completes full round-trip for create_text", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_3_test03",
      command: "create_text",
      args: { content: "Hello World", name: "Greeting" },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ResponseMessage;
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.type).toBe("TEXT");
      expect(resp.data.characters).toBe("Hello World");
    }

    mcpClient.close();
    plugin.close();
  });

  it("completes full round-trip for get_document_info", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_4_test04",
      command: "get_document_info",
      args: {},
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ResponseMessage;
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.documentName).toBe("Test Document");
      expect(resp.data.pages).toHaveLength(1);
    }

    mcpClient.close();
    plugin.close();
  });

  it("handles multiple sequential commands", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    // Send 3 commands sequentially
    for (let i = 1; i <= 3; i++) {
      const commandMsg = {
        type: "COMMAND",
        requestId: `req_${i}_seq${i.toString().padStart(3, "0")}`,
        command: "create_frame",
        args: { name: `Frame ${i}`, width: 100 * i, height: 100 },
      };

      const responsePromise = waitForMessage(mcpClient);
      mcpClient.send(JSON.stringify(commandMsg));
      const response = await responsePromise;

      expect(response.type).toBe("RESPONSE");
      expect((response as ResponseMessage).success).toBe(true);
    }

    mcpClient.close();
    plugin.close();
  });

  it("handles plugin error response correctly", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();

    // Plugin sends error for any command
    plugin.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as WireMessage;
      if (msg.type !== "COMMAND") return;

      plugin.send(JSON.stringify({
        type: "RESPONSE",
        requestId: (msg as CommandMessage).requestId,
        success: false,
        error: {
          code: "NODE_NOT_FOUND",
          message: "Node 999:999 does not exist",
        },
      }));
    });

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_5_err001",
      command: "get_node",
      args: { nodeId: "999:999" },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ErrorResponseMsg;
    expect(resp.success).toBe(false);
    expect(resp.error.code).toBe("NODE_NOT_FOUND");
    expect(resp.error.message).toContain("999:999");

    mcpClient.close();
    plugin.close();
  });

  it("handles plugin disconnect mid-request", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();

    // Plugin receives command but disconnects before responding
    plugin.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "COMMAND") {
        // Disconnect instead of responding
        plugin.close();
      }
    });

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_6_disc01",
      command: "create_frame",
      args: { name: "Will Fail" },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ErrorResponseMsg;
    expect(resp.success).toBe(false);
    expect(resp.error.code).toBe("PLUGIN_DISCONNECTED");
  });

  it("handles delete_node round-trip", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_7_del001",
      command: "delete_node",
      args: { nodeId: "123:456" },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ResponseMessage;
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.deleted).toBe(true);
      expect(resp.data.nodeId).toBe("123:456");
    }

    mcpClient.close();
    plugin.close();
  });

  it("handles zoom_to_node round-trip", async () => {
    const plugin = await connectMockPlugin();
    const mcpClient = await connectMcpClient();
    setupAutoRespondPlugin(plugin);

    const commandMsg = {
      type: "COMMAND",
      requestId: "req_8_zoom01",
      command: "zoom_to_node",
      args: { nodeId: "123:456" },
    };

    const responsePromise = waitForMessage(mcpClient);
    mcpClient.send(JSON.stringify(commandMsg));
    const response = await responsePromise;

    expect(response.type).toBe("RESPONSE");
    const resp = response as ResponseMessage;
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.nodeId).toBe("123:456");
      expect(resp.data.viewport).toBeDefined();
    }

    mcpClient.close();
    plugin.close();
  });
});
