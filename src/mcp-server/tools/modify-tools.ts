import { z } from "zod";
import {
  NodeId,
  RGBAColor,
  Fill,
  Typography,
  Padding,
  AutoLayoutAlign,
} from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetAutoLayoutInput = z
  .object({
    nodeId: NodeId.describe("Target frame node ID"),
    direction: z.enum(["HORIZONTAL", "VERTICAL"]).describe("Layout direction"),
    gap: z
      .number()
      .min(0)
      .max(10000)
      .default(0)
      .describe("Spacing between children"),
    padding: Padding.default({ top: 0, right: 0, bottom: 0, left: 0 }),
    primaryAxisAlign: AutoLayoutAlign.default("MIN").describe(
      "Alignment along primary axis",
    ),
    counterAxisAlign: z
      .enum(["MIN", "CENTER", "MAX"])
      .default("MIN")
      .describe("Alignment along counter axis"),
  })
  .strict();

export const UpdateTextInput = z
  .object({
    nodeId: NodeId,
    content: z.string().min(1).max(100000).optional(),
    typography: Typography.partial().optional(),
    fills: z.array(Fill).max(20).optional(),
  })
  .strict();

export const UpdateNodeInput = z
  .object({
    nodeId: NodeId,
    x: z.number().min(-100000).max(100000).optional(),
    y: z.number().min(-100000).max(100000).optional(),
    width: z.number().positive().max(100000).optional(),
    height: z.number().positive().max(100000).optional(),
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
    name: z.string().max(500).optional(),
    cornerRadius: z.number().min(0).max(10000).optional(),
    fills: z.array(Fill).max(20).optional(),
  })
  .strict();

export const AddShadowInput = z
  .object({
    nodeId: NodeId,
    color: RGBAColor.default({ r: 0, g: 0, b: 0, a: 0.25 }),
    offsetX: z.number().min(-1000).max(1000).default(0),
    offsetY: z.number().min(-1000).max(1000).default(4),
    blur: z.number().min(0).max(1000).default(8),
    spread: z.number().min(-1000).max(1000).default(0),
  })
  .strict();

export const MODIFY_TOOLS: Record<string, ToolDefinition> = {
  set_auto_layout: {
    description: "Apply or update auto layout on a frame",
    inputSchema: SetAutoLayoutInput,
  },
  update_text: {
    description: "Update text content or style of an existing text node",
    inputSchema: UpdateTextInput,
  },
  update_node: {
    description:
      "Update position, size, opacity, visibility, name, cornerRadius, or fills of any node",
    inputSchema: UpdateNodeInput,
  },
  add_shadow: {
    description: "Add a drop shadow effect to a node",
    inputSchema: AddShadowInput,
  },
};
