import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "url";
import { TOOL_REGISTRY } from "./tools/index.js";
import { generateRequestId } from "./request-tracker.js";
import { connectWebSocket, sendCommand, tracker } from "./ws-client.js";

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "figma-mcp",
  version: "1.0.0",
});

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

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error("[mcp] Fatal error:", err);
    process.exit(1);
  });
}

export { server, sendCommand, generateRequestId, connectWebSocket, tracker };
