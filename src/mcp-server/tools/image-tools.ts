import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

const ScaleMode = z
  .enum(["FILL", "FIT", "CROP", "TILE"])
  .default("FILL")
  .describe(
    "FILL = cover the node (may crop), FIT = fit inside (may letterbox), CROP = manual crop, TILE = repeat",
  );

export const SetImageFillInput = z
  .object({
    nodeId: NodeId,
    imageData: z
      .string()
      .min(1)
      .describe(
        "Base64-encoded image bytes (PNG, JPG, GIF, SVG, or WEBP). Max ~750KB base64.",
      ),
    scaleMode: ScaleMode,
  })
  .strict();

export const SetImageFromUrlInput = z
  .object({
    nodeId: NodeId,
    url: z
      .string()
      .url()
      .describe("Public image URL (PNG, JPG, GIF, WEBP). The server fetches and applies it — no manual base64 needed."),
    scaleMode: ScaleMode,
  })
  .strict();

export const SetImageFromPathInput = z
  .object({
    nodeId: NodeId,
    filePath: z
      .string()
      .min(1)
      .describe("Absolute path to a local image file (PNG, JPG, GIF, WEBP). The server reads and applies it — no manual base64 needed."),
    scaleMode: ScaleMode,
  })
  .strict();

export const IMAGE_TOOLS: Record<string, ToolDefinition> = {
  set_image_fill: {
    description:
      "Apply an image as a fill to any node using raw base64 data. Use set_image_from_url or set_image_from_path instead when you have a URL or file path — they handle encoding automatically.",
    inputSchema: SetImageFillInput,
  },
  set_image_from_url: {
    description:
      "Fetch an image from a public URL and apply it as a fill to a node. The server handles all fetching and encoding — just provide the URL. Use for stock photos, CDN images, or any publicly accessible image link.",
    inputSchema: SetImageFromUrlInput,
  },
  set_image_from_path: {
    description:
      "Read a local image file by absolute path and apply it as a fill to a node. The server reads and encodes the file automatically. Use for images already on disk — desktop files, exports, screenshots, etc.",
    inputSchema: SetImageFromPathInput,
  },
};
