import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "url";
import { TOOL_REGISTRY } from "./tools/index.js";
import { generateRequestId } from "./request-tracker.js";
import { connectWebSocket, sendCommand, tracker } from "./ws-client.js";
import { createLogger, MetricsCollector } from "../shared/logger/index.js";

// ─── Logging & Metrics ──────────────────────────────────────────────────────

const log = createLogger({ component: "mcp" });
const metrics = new MetricsCollector();

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
      const startTime = performance.now();
      const reqLog = log.child({ tool: name });

      try {
        reqLog.debug({ argKeys: Object.keys(args) }, "tool invoked");
        const result = await sendCommand(name, args);
        const durationMs = Math.round(performance.now() - startTime);

        metrics.recordCommand(name, durationMs);
        reqLog.info({ durationMs }, "tool completed");

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        metrics.recordCommand(name, durationMs);
        metrics.recordError(
          err instanceof Error ? err.message : "UNKNOWN",
        );
        reqLog.error({ err, durationMs }, "tool failed");

        return {
          content: [
            {
              type: "text" as const,
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
  log.info("figma mcp server started (stdio)");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    log.fatal({ err }, "fatal error");
    process.exit(1);
  });
}

export {
  server,
  sendCommand,
  generateRequestId,
  connectWebSocket,
  tracker,
  log,
  metrics,
};
