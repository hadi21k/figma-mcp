import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const GetDocumentInfoInput = z.object({}).strict();

export const GetSelectionInput = z.object({}).strict();

export const GetNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

export const READ_TOOLS: Record<string, ToolDefinition> = {
  get_document_info: {
    description:
      "Get document structure including all pages, top-level frames, and metadata. Call this FIRST before creating anything to understand the existing document layout, available pages, and where to place new elements. Check if relevant frames or components already exist before creating new ones.",
    inputSchema: GetDocumentInfoInput,
  },
  get_selection: {
    description:
      "Get all currently selected nodes with their properties (type, position, size, fills, strokes, effects). Use to inspect what the user is looking at or working with before making modifications.",
    inputSchema: GetSelectionInput,
  },
  get_node: {
    description:
      "Get detailed properties of a specific node by its ID, including children, fills, strokes, effects, typography, and layout settings. Use to inspect existing elements before modifying them or to understand the structure of a component before creating instances of it.",
    inputSchema: GetNodeInput,
  },
};
