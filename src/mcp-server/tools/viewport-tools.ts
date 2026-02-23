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
    description:
      "Scroll and zoom the canvas to center on a specific node. Use after creating or modifying elements so the user can see the result. Especially useful after creating new frames or components in empty canvas areas.",
    inputSchema: ZoomToNodeInput,
  },
};
