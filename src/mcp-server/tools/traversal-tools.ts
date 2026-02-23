import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const FindNodesInput = z
  .object({
    types: z
      .array(
        z.enum([
          "FRAME",
          "GROUP",
          "COMPONENT",
          "INSTANCE",
          "TEXT",
          "RECTANGLE",
          "ELLIPSE",
          "LINE",
          "POLYGON",
          "VECTOR",
          "BOOLEAN_OPERATION",
          "SECTION",
        ]),
      )
      .optional()
      .describe("Filter by node type(s). Omit to search all types."),
    namePattern: z
      .string()
      .max(500)
      .optional()
      .describe("Substring to match against node names (case-sensitive)"),
    parentId: NodeId.optional().describe(
      "Scope search to descendants of this node. Omit to search current page.",
    ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Maximum number of results to return"),
  })
  .strict();

export const TRAVERSAL_TOOLS: Record<string, ToolDefinition> = {
  find_nodes: {
    description:
      "Search for nodes by type and/or name pattern. Use to locate existing elements before modifying them, find all instances of a component, or audit the document structure. Scoped to current page by default, or to a specific subtree with parentId.",
    inputSchema: FindNodesInput,
  },
};
