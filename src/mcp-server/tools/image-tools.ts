import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetImageFillInput = z
  .object({
    nodeId: NodeId,
    imageData: z
      .string()
      .min(1)
      .describe(
        "Base64-encoded image bytes (PNG, JPG, GIF, SVG, or WEBP). Max ~750KB base64.",
      ),
    scaleMode: z
      .enum(["FILL", "FIT", "CROP", "TILE"])
      .default("FILL")
      .describe(
        "FILL = cover the node (may crop), FIT = fit inside (may letterbox), CROP = manual crop, TILE = repeat",
      ),
  })
  .strict();

export const IMAGE_TOOLS: Record<string, ToolDefinition> = {
  set_image_fill: {
    description:
      "Apply an image as a fill to any node. Use for hero images, avatars, thumbnails, background photos, and product images. imageData must be base64-encoded. scaleMode FILL covers the node (like CSS cover), FIT shows the full image, TILE repeats it. Note: large images increase message size -- prefer images under 500KB.",
    inputSchema: SetImageFillInput,
  },
};
