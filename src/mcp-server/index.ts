import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, extname } from "path";
import { TOOL_REGISTRY } from "./tools/index.js";
import { generateRequestId } from "./request-tracker.js";
import { connectWebSocket, sendCommand, tracker } from "./ws-client.js";
import { createLogger, MetricsCollector } from "../shared/logger/index.js";
import type { Logger } from "pino";

const IMAGE_FETCH_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 750_000;
const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
]);

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

        // ── Server-side image helpers (never sent to the plugin as-is) ──────
        if (name === "set_image_from_url") {
          const res = await handleSetImageFromUrl(args as { nodeId: string; url: string; scaleMode?: string }, reqLog);
          const durationMs = Math.round(performance.now() - startTime);
          metrics.recordCommand(name, durationMs);
          reqLog.info({ durationMs }, "tool completed");
          return res;
        }
        if (name === "set_image_from_path") {
          const res = await handleSetImageFromPath(args as { nodeId: string; filePath: string; scaleMode?: string }, reqLog);
          const durationMs = Math.round(performance.now() - startTime);
          metrics.recordCommand(name, durationMs);
          reqLog.info({ durationMs }, "tool completed");
          return res;
        }

        const result = await sendCommand(name, args);
        const durationMs = Math.round(performance.now() - startTime);

        metrics.recordCommand(name, durationMs);
        reqLog.info({ durationMs }, "tool completed");

        // Return export_node result as a visible image block
        if (name === "export_node") {
          return handleExportResult(result as unknown as ExportResult, reqLog);
        }

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

// ─── set_image_from_url ───────────────────────────────────────────────────────

async function handleSetImageFromUrl(
  args: { nodeId: string; url: string; scaleMode?: string },
  reqLog: Logger,
) {
  const { nodeId, url, scaleMode = "FILL" } = args;
  reqLog.info({ url }, "fetching image from URL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Image fetch timed out after ${IMAGE_FETCH_TIMEOUT_MS}ms: ${url}`);
    }
    throw new Error(`Failed to fetch image: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status}): ${url}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (contentType && !ALLOWED_IMAGE_CONTENT_TYPES.some((t) => contentType.startsWith(t))) {
    throw new Error(`URL returned unsupported Content-Type "${contentType}". Expected an image (PNG, JPG, GIF, WEBP, SVG).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is ${(buffer.length / 1024).toFixed(0)}KB which exceeds the ${(MAX_IMAGE_BYTES / 1024).toFixed(0)}KB limit. Resize the image or use a smaller one.`,
    );
  }

  const imageData = buffer.toString("base64");
  reqLog.info({ bytes: buffer.length, nodeId }, "image fetched, applying fill");

  const result = await sendCommand("set_image_fill", { nodeId, imageData, scaleMode });
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

// ─── set_image_from_path ─────────────────────────────────────────────────────

async function handleSetImageFromPath(
  args: { nodeId: string; filePath: string; scaleMode?: string },
  reqLog: Logger,
) {
  const { nodeId, filePath, scaleMode = "FILL" } = args;
  reqLog.info({ filePath }, "reading image from disk");

  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension "${ext}". Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`);
  }

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = readFileSync(filePath);
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is ${(buffer.length / 1024).toFixed(0)}KB which exceeds the ${(MAX_IMAGE_BYTES / 1024).toFixed(0)}KB limit. Resize the image or use a smaller one.`,
    );
  }

  const imageData = buffer.toString("base64");
  reqLog.info({ bytes: buffer.length, nodeId }, "image read, applying fill");

  const result = await sendCommand("set_image_fill", { nodeId, imageData, scaleMode });
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

// ─── export_node image response ──────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  SVG: "image/svg+xml",
  PDF: "application/pdf",
};

interface ExportResult {
  nodeId: string;
  format: string;
  scale: number;
  base64Data: string;
  size: number;
}

function handleExportResult(result: ExportResult, reqLog: Logger) {
  const mimeType = MIME_TYPES[result.format] ?? "image/png";

  // Auto-save to exports/ dir (or FIGMA_EXPORT_DIR env var)
  let savedTo = "";
  try {
    const exportDir = resolve(process.env.FIGMA_EXPORT_DIR ?? "./exports");
    mkdirSync(exportDir, { recursive: true });
    const ext = result.format.toLowerCase();
    const filename = `${result.nodeId.replace(":", "-")}_${Date.now()}.${ext}`;
    savedTo = join(exportDir, filename);
    writeFileSync(savedTo, Buffer.from(result.base64Data, "base64"));
    reqLog.info({ savedTo }, "export saved to disk");
  } catch (saveErr) {
    reqLog.warn({ saveErr }, "could not auto-save export to disk");
  }

  return {
    content: [
      // Image block — Claude can see this directly as a visual
      {
        type: "image" as const,
        data: result.base64Data,
        mimeType,
      },
      // Metadata text
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            nodeId: result.nodeId,
            format: result.format,
            scale: result.scale,
            size: result.size,
            ...(savedTo && { savedTo }),
          },
          null,
          2,
        ),
      },
    ],
  };
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
