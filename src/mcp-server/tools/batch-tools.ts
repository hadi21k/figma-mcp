import { z } from "zod";
import { NodeId, Fill } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const BatchCreateInput = z
  .object({
    operations: z
      .array(
        z
          .object({
            command: z
              .enum([
                "create_frame",
                "create_rectangle",
                "create_ellipse",
                "create_text",
                "create_line",
                "create_polygon",
              ])
              .describe("Create command to execute"),
            args: z.record(z.string(), z.unknown()).describe("Arguments for the command"),
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .describe("List of create operations to execute in sequence"),
  })
  .strict();

export const BatchUpdateInput = z
  .object({
    updates: z
      .array(
        z
          .object({
            nodeId: NodeId,
            x: z.number().min(-100000).max(100000).optional(),
            y: z.number().min(-100000).max(100000).optional(),
            width: z.number().positive().max(100000).optional(),
            height: z.number().positive().max(100000).optional(),
            opacity: z.number().min(0).max(1).optional(),
            visible: z.boolean().optional(),
            name: z.string().max(500).optional(),
            fills: z.array(Fill).max(20).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .describe("List of nodes to update in a single operation"),
  })
  .strict();

export const BATCH_TOOLS: Record<string, ToolDefinition> = {
  batch_create: {
    description:
      "Create multiple nodes in a single call. Reduces round-trips for repetitive structures like grids of cards, lists of items, or sets of icons. Each operation specifies a command and its args. Returns an array of created node IDs. Partial failures are reported per-operation.",
    inputSchema: BatchCreateInput,
  },
  batch_update: {
    description:
      "Update properties of multiple nodes in a single call. Efficiently update position, size, opacity, visibility, or fills across many nodes at once. Use for bulk repositioning, batch opacity changes, or updating a list of items. Partial failures are reported per-node.",
    inputSchema: BatchUpdateInput,
  },
};
