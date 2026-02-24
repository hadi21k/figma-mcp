import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "url";
import { readFile, writeFile, mkdir } from "fs/promises";
import { writeFileSync, mkdirSync } from "fs";
import { join, resolve, extname } from "path";
import sharp from "sharp";
import { TOOL_REGISTRY } from "./tools/index.js";
import { generateRequestId } from "./request-tracker.js";
import { connectWebSocket, sendCommand, tracker } from "./ws-client.js";
import { createLogger, MetricsCollector } from "../shared/logger/index.js";
import type { Logger } from "pino";

const IMAGE_FETCH_TIMEOUT_MS = 30_000;

// ─── SSRF protection ────────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/, /^fe80:/, /^fd/,
];

function assertPublicUrl(raw: string): URL {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || PRIVATE_IP_PATTERNS.some((re) => re.test(hostname))) {
    throw new Error("URLs pointing to private or internal networks are not allowed");
  }
  return parsed;
}
const MAX_IMAGE_BYTES = 5_242_880; // 5 MB — allows high-res images
const OPTIMIZE_TARGET_BYTES = 4_800_000; // target size after optimization (some headroom)
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
          const res = await handleSetImageFromUrl(args as unknown as ImageArgs & { url: string }, reqLog);
          const durationMs = Math.round(performance.now() - startTime);
          metrics.recordCommand(name, durationMs);
          reqLog.info({ durationMs }, "tool completed");
          return res;
        }
        if (name === "set_image_from_path") {
          const res = await handleSetImageFromPath(args as unknown as ImageArgs & { filePath: string }, reqLog);
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

// ─── Image args shared type ──────────────────────────────────────────────────

interface ImageArgs {
  nodeId: string;
  scaleMode?: string;
  focalPointX?: number;
  focalPointY?: number;
  zoom?: number;
  preserveFills?: boolean;
  opacity?: number;
}

// ─── Auto-optimization ───────────────────────────────────────────────────────

async function optimizeImage(input: Uint8Array, reqLog: Logger): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  reqLog.info(
    { originalBytes: input.length, width: meta.width, height: meta.height, format: meta.format },
    "optimizing oversized image",
  );

  const width = meta.width ?? 2400;
  let result: Buffer = Buffer.from(input);

  for (const scale of [0.75, 0.5, 0.35, 0.25]) {
    const targetWidth = Math.round(width * scale);
    result = Buffer.from(
      await sharp(input)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
    );

    reqLog.debug({ targetWidth, resultBytes: result.length }, "resize attempt");
    if (result.length <= OPTIMIZE_TARGET_BYTES) break;
  }

  if (result.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image could not be optimized below ${(MAX_IMAGE_BYTES / 1024).toFixed(0)}KB (best: ${(result.length / 1024).toFixed(0)}KB). Use a smaller source image.`,
    );
  }

  reqLog.info(
    { originalBytes: input.length, optimizedBytes: result.length },
    "image optimized successfully",
  );
  return result;
}

// ─── set_image_from_url ───────────────────────────────────────────────────────

async function handleSetImageFromUrl(
  args: ImageArgs & { url: string },
  reqLog: Logger,
) {
  const { nodeId, url, scaleMode = "FILL", focalPointX, focalPointY, zoom, preserveFills, opacity } = args;
  assertPublicUrl(url);
  reqLog.info({ url }, "fetching image from URL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, redirect: "error" });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Image fetch timed out");
    }
    throw new Error("Failed to fetch image from the provided URL");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status})`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (contentType && !ALLOWED_IMAGE_CONTENT_TYPES.some((t) => contentType.startsWith(t))) {
    throw new Error(`URL returned unsupported Content-Type "${contentType}". Expected an image (PNG, JPG, GIF, WEBP, SVG).`);
  }

  let buffer: Buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) {
    buffer = await optimizeImage(buffer, reqLog);
  }

  const imageData = buffer.toString("base64");
  reqLog.info({ bytes: buffer.length, nodeId }, "image fetched, applying fill");

  const result = await sendCommand("set_image_fill", {
    nodeId, imageData, scaleMode, focalPointX, focalPointY, zoom, preserveFills, opacity,
  });
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

// ─── set_image_from_path ─────────────────────────────────────────────────────

async function handleSetImageFromPath(
  args: ImageArgs & { filePath: string },
  reqLog: Logger,
) {
  const { nodeId, filePath, scaleMode = "FILL", focalPointX, focalPointY, zoom, preserveFills, opacity } = args;
  reqLog.info({ filePath }, "reading image from disk");

  const ext = extname(filePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported file extension. Allowed: " + [...ALLOWED_IMAGE_EXTENSIONS].join(", "));
  }

  const resolvedPath = resolve(filePath);
  const allowedRoot = process.env.FIGMA_IMAGE_ROOT;
  if (allowedRoot) {
    const resolvedRoot = resolve(allowedRoot);
    if (!resolvedPath.startsWith(resolvedRoot + "/") && !resolvedPath.startsWith(resolvedRoot + "\\") && resolvedPath !== resolvedRoot) {
      throw new Error("File path is outside the allowed image directory");
    }
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await readFile(resolvedPath));
  } catch {
    throw new Error("The specified image file could not be found or read");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    buffer = await optimizeImage(buffer, reqLog);
  }

  const imageData = buffer.toString("base64");
  reqLog.info({ bytes: buffer.length, nodeId }, "image read, applying fill");

  const result = await sendCommand("set_image_fill", {
    nodeId, imageData, scaleMode, focalPointX, focalPointY, zoom, preserveFills, opacity,
  });
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
    const safeId = result.nodeId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeId}_${Date.now()}.${ext}`;
    savedTo = join(exportDir, filename);
    const resolvedExport = resolve(savedTo);
    if (!resolvedExport.startsWith(resolve(exportDir))) {
      throw new Error("Export path escapes export directory");
    }
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

process.on("unhandledRejection", (reason) => {
  log.fatal({ reason }, "unhandled rejection — shutting down");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  log.fatal({ err }, "uncaught exception — shutting down");
  process.exit(1);
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    log.fatal({ err }, "fatal error");
    process.exit(1);
  });

  process.on("SIGINT", () => {
    log.info("shutting down (SIGINT)");
    log.info({ metrics: metrics.snapshot() }, "final metrics snapshot");
    tracker.rejectAll(new Error("Server shutting down"));
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log.info("shutting down (SIGTERM)");
    log.info({ metrics: metrics.snapshot() }, "final metrics snapshot");
    tracker.rejectAll(new Error("Server shutting down"));
    process.exit(0);
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
