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

export const ORGANIZE_TOOLS: Record<string, ToolDefinition> = {
  group_nodes: {
    description: "Group multiple nodes together",
    inputSchema: GroupNodesInput,
  },
  delete_node: {
    description: "Delete a node from the document",
    inputSchema: DeleteNodeInput,
  },
  create_component: {
    description: "Convert an existing node into a reusable component",
    inputSchema: CreateComponentInput,
  },
};
