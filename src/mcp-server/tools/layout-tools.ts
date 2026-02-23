import { z } from "zod";
import { NodeId, LayoutSizing, LayoutAlign } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetNodeLayoutPropertiesInput = z
  .object({
    nodeId: NodeId.describe(
      "ID of the child node inside an auto-layout frame",
    ),
    layoutAlign: LayoutAlign.optional().describe(
      "INHERIT = use parent alignment, STRETCH = fill counter axis",
    ),
    layoutGrow: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "0 = fixed size on primary axis, 1 = fill remaining space on primary axis",
      ),
    layoutPositioning: z
      .enum(["AUTO", "ABSOLUTE"])
      .optional()
      .describe(
        "AUTO = participates in auto-layout flow, ABSOLUTE = positioned independently",
      ),
    layoutSizingHorizontal: LayoutSizing.optional().describe(
      "FIXED = fixed width, HUG = shrink to contents, FILL = expand to fill parent",
    ),
    layoutSizingVertical: LayoutSizing.optional().describe(
      "FIXED = fixed height, HUG = shrink to contents, FILL = expand to fill parent",
    ),
    minWidth: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe("Minimum width constraint"),
    maxWidth: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe("Maximum width constraint"),
    minHeight: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe("Minimum height constraint"),
    maxHeight: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe("Maximum height constraint"),
  })
  .strict();

export const LAYOUT_TOOLS: Record<string, ToolDefinition> = {
  set_node_layout_properties: {
    description:
      "Set child-level auto-layout properties for a node inside an auto-layout frame. Use layoutSizingHorizontal/Vertical to control sizing behavior: FIXED keeps exact size, HUG shrinks to content, FILL expands to fill parent. Use layoutGrow=1 to make an element expand to fill remaining space. Use layoutPositioning=ABSOLUTE to take a node out of the flow for overlays.",
    inputSchema: SetNodeLayoutPropertiesInput,
  },
};
