import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreateComponentInstanceInput = z
  .object({
    componentId: NodeId.describe(
      "ID of the master component (get from get_local_components)",
    ),
    x: z
      .number()
      .min(-100000)
      .max(100000)
      .default(0)
      .describe("X position for the instance"),
    y: z
      .number()
      .min(-100000)
      .max(100000)
      .default(0)
      .describe("Y position for the instance"),
    parentId: NodeId.optional().describe(
      "Parent frame/group to place instance in",
    ),
  })
  .strict();

export const GetLocalComponentsInput = z.object({}).strict();

export const ListAvailableFontsInput = z.object({}).strict();

export const COMPONENT_TOOLS: Record<string, ToolDefinition> = {
  create_component_instance: {
    description:
      "Create an instance of an existing component. This is the PREFERRED way to place repeated UI elements (buttons, cards, icons, list items) -- instances stay linked to the master component so changes propagate automatically. Always call get_local_components first to discover available components before creating instances.",
    inputSchema: CreateComponentInstanceInput,
  },
  get_local_components: {
    description:
      "List all local components defined in the document. Returns component IDs, names, and keys. Call this before using create_component_instance to find available components. Also useful to check if a design system is already set up before creating new components from scratch.",
    inputSchema: GetLocalComponentsInput,
  },
  list_available_fonts: {
    description:
      "List all fonts available in the Figma environment. Call this before using typography tools to find valid font families and styles. Prevents font errors from using unavailable fonts. Common safe fonts: Inter, Roboto, SF Pro, Helvetica Neue.",
    inputSchema: ListAvailableFontsInput,
  },
};
