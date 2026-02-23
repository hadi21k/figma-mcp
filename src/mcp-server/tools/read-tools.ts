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
    description: "Get document metadata, pages, and top-level frames",
    inputSchema: GetDocumentInfoInput,
  },
  get_selection: {
    description: "Get all currently selected nodes with properties",
    inputSchema: GetSelectionInput,
  },
  get_node: {
    description: "Get detailed properties of a node by ID",
    inputSchema: GetNodeInput,
  },
};
