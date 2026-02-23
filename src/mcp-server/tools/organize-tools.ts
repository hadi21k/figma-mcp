import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const GroupNodesInput = z
  .object({
    nodeIds: z
      .array(NodeId)
      .min(2)
      .max(100)
      .describe("At least 2 node IDs to group"),
    name: z.string().max(500).default("Group"),
  })
  .strict();

export const DeleteNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

export const CreateComponentInput = z
  .object({
    nodeId: NodeId.describe("ID of existing node to convert to component"),
  })
  .strict();

export const CloneNodeInput = z
  .object({
    nodeId: NodeId.describe("ID of the node to duplicate"),
    x: z
      .number()
      .min(-100000)
      .max(100000)
      .optional()
      .describe("X position for the clone (defaults to same as original)"),
    y: z
      .number()
      .min(-100000)
      .max(100000)
      .optional()
      .describe("Y position for the clone (defaults to same as original)"),
    parentId: NodeId.optional().describe(
      "Parent node ID for the clone (defaults to same parent as original)",
    ),
  })
  .strict();

export const ReorderNodeInput = z
  .object({
    nodeId: NodeId.describe("ID of the node to reorder"),
    index: z
      .number()
      .int()
      .min(0)
      .describe(
        "Target index within the parent (0 = bottom/back, higher = top/front)",
      ),
  })
  .strict();

export const ORGANIZE_TOOLS: Record<string, ToolDefinition> = {
  group_nodes: {
    description:
      "Group multiple nodes into a visual group. Prefer using frames with auto-layout over groups for UI layouts -- groups do not support auto-layout or padding. Use groups only for visual clusters that need to move together but don't need layout behavior (e.g. an illustration made of multiple shapes).",
    inputSchema: GroupNodesInput,
  },
  delete_node: {
    description:
      "Permanently remove a node and all its children from the document. Use when rebuilding or cleaning up elements. Cannot be undone through this tool.",
    inputSchema: DeleteNodeInput,
  },
  create_component: {
    description:
      "Convert an existing node (frame, group, or shape) into a reusable Figma component. Create components for any element that repeats in the design: buttons, cards, list items, icons, input fields, badges. After creating a component, use create_component_instance to place copies that stay linked to the master component.",
    inputSchema: CreateComponentInput,
  },
  clone_node: {
    description:
      "Duplicate an existing node with all its properties, children, and styles. Use to efficiently create repeated elements like list items, grid cells, or button variants. Prefer create_component_instance over cloning if the elements should stay linked to a master component.",
    inputSchema: CloneNodeInput,
  },
  reorder_node: {
    description:
      "Move a node to a specific z-order index within its parent. Use to control which elements appear on top of others. Index 0 is the bottom (back), higher indices are on top (front). Use to fix layering issues or bring elements to front/send to back.",
    inputSchema: ReorderNodeInput,
  },
};
