import { z } from "zod";
import { NodeId, Fill } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreateVectorInput = z
  .object({
    name: z.string().max(500).default("Vector"),
    vectorPaths: z
      .array(
        z
          .object({
            data: z
              .string()
              .min(1)
              .describe(
                "SVG path data string (the 'd' attribute), e.g. 'M 0 0 L 100 0 L 100 100 Z'",
              ),
            windingRule: z
              .enum(["EVENODD", "NONZERO"])
              .default("EVENODD")
              .describe("Path fill rule"),
          })
          .strict(),
      )
      .min(1)
      .max(10)
      .describe("SVG path definitions"),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    fills: z
      .array(Fill)
      .max(20)
      .default([
        {
          type: "SOLID",
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
        },
      ]),
    parentId: NodeId.optional(),
  })
  .strict();

export const CreateBooleanOperationInput = z
  .object({
    nodeIds: z
      .array(NodeId)
      .min(2)
      .max(50)
      .describe(
        "Node IDs to combine. For SUBTRACT, first node is the base shape.",
      ),
    operation: z
      .enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"])
      .describe(
        "UNION = merge shapes, INTERSECT = keep overlap, SUBTRACT = cut second from first, EXCLUDE = keep non-overlapping parts",
      ),
    name: z.string().max(500).optional().describe("Name for the result node"),
  })
  .strict();

export const VECTOR_TOOLS: Record<string, ToolDefinition> = {
  create_vector: {
    description:
      "Create a vector node from SVG path data. Use for custom icons, logos, decorative shapes, or any shape that cannot be made with basic primitives. Accepts standard SVG 'd' path attribute syntax. Multiple paths can be combined in one vector node.",
    inputSchema: CreateVectorInput,
  },
  create_boolean_operation: {
    description:
      "Combine multiple shapes using boolean operations to create complex shapes. UNION merges all shapes, INTERSECT keeps only the overlapping area, SUBTRACT cuts the second shape from the first, EXCLUDE keeps non-overlapping parts. Use for creating custom icons, cutouts, and compound shapes.",
    inputSchema: CreateBooleanOperationInput,
  },
};
