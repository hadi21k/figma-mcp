import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const ZoomToNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

export const VIEWPORT_TOOLS: Record<string, ToolDefinition> = {
  zoom_to_node: {
    description: "Scroll and zoom canvas to center on a node",
    inputSchema: ZoomToNodeInput,
  },
};
