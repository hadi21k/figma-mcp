import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const ExportNodeInput = z
  .object({
    nodeId: NodeId,
    format: z
      .enum(["PNG", "JPG", "SVG", "PDF"])
      .default("PNG")
      .describe("Export file format"),
    scale: z
      .number()
      .positive()
      .max(4)
      .default(1)
      .describe("Scale multiplier for raster formats (1x, 2x, 3x). SVG/PDF ignore this."),
  })
  .strict();

export const EXPORT_TOOLS: Record<string, ToolDefinition> = {
  export_node: {
    description:
      "Export a node as PNG, JPG, SVG, or PDF. Returns base64-encoded data. Use to preview or verify designs, extract assets, or generate deliverables. Use scale=2 for retina-ready PNG exports. SVG is best for icons and vector graphics.",
    inputSchema: ExportNodeInput,
  },
};
