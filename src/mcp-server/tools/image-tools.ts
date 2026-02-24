import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

const ScaleMode = z
  .enum(["FILL", "FIT", "CROP", "TILE"])
  .default("FILL")
  .describe(
    "FILL = cover the node (may crop), FIT = fit inside (may letterbox), CROP = manual crop, TILE = repeat",
  );

const FocalPointX = z
  .number()
  .min(0)
  .max(1)
  .optional()
  .describe("Horizontal focus point 0-1 (0=left edge, 0.5=center, 1=right edge). Only applies with FILL or CROP scaleMode.");

const FocalPointY = z
  .number()
  .min(0)
  .max(1)
  .optional()
  .describe("Vertical focus point 0-1 (0=top edge, 0.5=center, 1=bottom edge). Only applies with FILL or CROP scaleMode.");

const Zoom = z
  .number()
  .min(0.01)
  .max(10)
  .optional()
  .describe("Zoom level into the focal point (1=default, 2=2x zoom in, 0.5=zoom out). Only applies with FILL or CROP scaleMode.");

const PreserveFills = z
  .boolean()
  .default(false)
  .describe("When true, append the image fill to existing fills instead of replacing them. Useful for layering images over gradients or colors.");

const ImageOpacity = z
  .number()
  .min(0)
  .max(1)
  .default(1)
  .describe("Opacity of the image fill (0=transparent, 1=opaque). Useful for watermarks or overlay effects.");

export const SetImageFillInput = z
  .object({
    nodeId: NodeId,
    imageData: z
      .string()
      .min(1)
      .describe(
        "Base64-encoded image bytes (PNG, JPG, GIF, SVG, or WEBP). Images over 5MB are auto-optimized.",
      ),
    scaleMode: ScaleMode,
    focalPointX: FocalPointX,
    focalPointY: FocalPointY,
    zoom: Zoom,
    preserveFills: PreserveFills,
    opacity: ImageOpacity,
  })
  .strict();

export const SetImageFromUrlInput = z
  .object({
    nodeId: NodeId,
    url: z
      .string()
      .url()
      .describe("Public image URL (PNG, JPG, GIF, WEBP). The server fetches, auto-optimizes if needed, and applies it."),
    scaleMode: ScaleMode,
    focalPointX: FocalPointX,
    focalPointY: FocalPointY,
    zoom: Zoom,
    preserveFills: PreserveFills,
    opacity: ImageOpacity,
  })
  .strict();

export const SetImageFromPathInput = z
  .object({
    nodeId: NodeId,
    filePath: z
      .string()
      .min(1)
      .describe("Absolute path to a local image file (PNG, JPG, GIF, WEBP). The server reads, auto-optimizes if needed, and applies it."),
    scaleMode: ScaleMode,
    focalPointX: FocalPointX,
    focalPointY: FocalPointY,
    zoom: Zoom,
    preserveFills: PreserveFills,
    opacity: ImageOpacity,
  })
  .strict();

export const IMAGE_TOOLS: Record<string, ToolDefinition> = {
  set_image_fill: {
    description:
      "Apply an image as a fill to any node using raw base64 data. Supports focal-point cropping, fill opacity, and preserving existing fills. Use set_image_from_url or set_image_from_path instead when you have a URL or file path — they handle encoding and auto-optimization automatically.",
    inputSchema: SetImageFillInput,
  },
  set_image_from_url: {
    description:
      "Fetch an image from a public URL and apply it as a fill to a node. Auto-optimizes oversized images. Supports focal-point cropping, fill opacity, and preserving existing fills. Use for stock photos, CDN images, or any publicly accessible image link.",
    inputSchema: SetImageFromUrlInput,
  },
  set_image_from_path: {
    description:
      "Read a local image file by absolute path and apply it as a fill to a node. Auto-optimizes oversized images. Supports focal-point cropping, fill opacity, and preserving existing fills. Use for images already on disk — desktop files, exports, screenshots, etc.",
    inputSchema: SetImageFromPathInput,
  },
};
