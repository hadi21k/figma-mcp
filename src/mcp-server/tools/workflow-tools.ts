import { z } from "zod";
import { NodeId, Effect } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const FlattenNodeInput = z
  .object({
    nodeId: NodeId.describe("ID of the node to flatten into a single vector"),
  })
  .strict();

export const UngroupNodesInput = z
  .object({
    nodeId: NodeId.describe("ID of the group to ungroup"),
  })
  .strict();

export const SetSelectionInput = z
  .object({
    nodeIds: z
      .array(NodeId)
      .max(100)
      .describe("Node IDs to select. Pass empty array to clear selection."),
  })
  .strict();

export const SetCurrentPageInput = z
  .object({
    pageId: NodeId.describe("ID of the page to navigate to"),
  })
  .strict();

export const CreateEffectStyleInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "Style name, e.g. 'Elevation/Low', 'Shadow/Card', 'Blur/Background'",
      ),
    effects: z
      .array(Effect)
      .min(1)
      .max(10)
      .describe("Effects that make up this style"),
  })
  .strict();

export const GetVariablesInput = z.object({}).strict();

export const WORKFLOW_TOOLS: Record<string, ToolDefinition> = {
  flatten_node: {
    description:
      "Flatten a node and its children into a single vector. Useful for finalizing icons or complex vector shapes before export. This is destructive — children are merged into one flat vector and cannot be separated afterwards.",
    inputSchema: FlattenNodeInput,
  },
  ungroup_nodes: {
    description:
      "Ungroup a group node, moving all children to the group's parent and removing the empty group. The inverse of group_nodes. Children retain their visual position. Use to break apart grouped elements for individual manipulation.",
    inputSchema: UngroupNodesInput,
  },
  set_selection: {
    description:
      "Set the current page selection to specific nodes. Pass an empty nodeIds array to clear selection. Use to chain workflows: create elements, then select them for the user to see, or select nodes before applying batch operations.",
    inputSchema: SetSelectionInput,
  },
  set_current_page: {
    description:
      "Navigate to a specific page by its ID. Use after get_document_info to switch between pages. Required before creating or reading elements on a different page than the current one.",
    inputSchema: SetCurrentPageInput,
  },
  create_effect_style: {
    description:
      "Create a reusable effect style (elevation/shadow token). Completes the style triad alongside paint and text styles. Use for consistent elevation system: Low, Medium, High shadows. After creating, use apply_style with effectStyleId to apply.",
    inputSchema: CreateEffectStyleInput,
  },
  get_variables: {
    description:
      "List all local variable collections and their variables. Returns collection IDs, names, modes, and all variables with their types and values per mode. Essential for reading existing design tokens before creating new ones or binding variables to nodes.",
    inputSchema: GetVariablesInput,
  },
};
