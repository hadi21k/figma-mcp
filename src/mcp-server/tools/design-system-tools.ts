import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CombineAsVariantsInput = z
  .object({
    nodeIds: z
      .array(NodeId)
      .min(2)
      .max(100)
      .describe("Component node IDs to combine. All must share the same parent."),
    name: z
      .string()
      .max(500)
      .optional()
      .describe("Name for the resulting component set"),
  })
  .strict();

export const DetachInstanceInput = z
  .object({
    nodeId: NodeId.describe("ID of the component instance to detach"),
  })
  .strict();

export const SwapComponentInput = z
  .object({
    nodeId: NodeId.describe("ID of the component instance to swap"),
    newComponentId: NodeId.describe("ID of the component to swap to"),
  })
  .strict();

export const ImportComponentByKeyInput = z
  .object({
    key: z
      .string()
      .min(1)
      .max(500)
      .describe("Component key from a shared library (found via get_local_components)"),
  })
  .strict();

export const DESIGN_SYSTEM_TOOLS: Record<string, ToolDefinition> = {
  combine_as_variants: {
    description:
      "Combine multiple components into a variant set (component with variants). All components must share the same parent. Use to build button variants (Primary, Secondary, Ghost), size variants (SM, MD, LG), or state variants (Default, Hover, Active, Disabled).",
    inputSchema: CombineAsVariantsInput,
  },
  detach_instance: {
    description:
      "Detach a component instance from its master component, converting it to a regular frame. The detached frame keeps all visual properties but is no longer linked to the component. Use for one-off customizations that should not affect other instances.",
    inputSchema: DetachInstanceInput,
  },
  swap_component: {
    description:
      "Swap the component that an instance references. The instance updates to reflect the new component while maintaining overrides where possible. Use to switch button variants, icon types, or any component replacement in-place.",
    inputSchema: SwapComponentInput,
  },
  import_component_by_key: {
    description:
      "Import a component from a shared library by its key. Returns the component so you can create instances of it. This makes a network call to fetch the component and may take a few seconds. Use when you need shared library components that are not local to the document.",
    inputSchema: ImportComponentByKeyInput,
  },
};
