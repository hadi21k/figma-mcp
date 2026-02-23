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
      .describe(
        "Spacing between children: 8px tight, 16px standard, 24-32px sections",
      ),
    padding: Padding.default({ top: 0, right: 0, bottom: 0, left: 0 }),
    primaryAxisAlign: AutoLayoutAlign.default("MIN").describe(
      "Alignment along primary axis",
    ),
    counterAxisAlign: z
      .enum(["MIN", "CENTER", "MAX"])
      .default("MIN")
      .describe("Alignment along counter axis"),
    layoutWrap: z
      .enum(["WRAP", "NO_WRAP"])
      .default("NO_WRAP")
      .describe("Allow children to wrap to next row/column"),
    counterAxisSpacing: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("Gap between wrapped rows/columns (when layoutWrap is WRAP)"),
    strokesIncludedInLayout: z
      .boolean()
      .default(false)
      .describe("Include stroke weight in layout size calculations"),
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
    description:
      "Apply auto-layout to a frame for automatic spacing, alignment, and responsive sizing. This is ESSENTIAL -- apply auto-layout to virtually every frame you create. Use VERTICAL for stacking elements top-to-bottom (page sections, card contents, form fields). Use HORIZONTAL for side-by-side elements (nav items, button rows, icon+text pairs). Set appropriate gap values: 8px for tight grouping, 16px for standard spacing, 24-32px for section separation.",
    inputSchema: SetAutoLayoutInput,
  },
  update_text: {
    description:
      "Update the content or typography of an existing text node. Use to change displayed text, font size, font family, color, alignment, or line height. For consistent designs, use the same typography settings across similar elements (all body text same size, all headings same font weight).",
    inputSchema: UpdateTextInput,
  },
  update_node: {
    description:
      "Update basic properties (position, size, opacity, visibility, name, cornerRadius, fills) of any existing node. For fill or stroke changes, prefer the dedicated set_fill and set_stroke tools when available. For corner radius, prefer set_corner_radius for individual corner control. Use this tool for quick multi-property updates or properties not covered by dedicated tools.",
    inputSchema: UpdateNodeInput,
  },
  add_shadow: {
    description:
      "Add a drop shadow to create depth and elevation. Use subtle shadows for cards and containers (blur: 4-8, opacity: 0.08-0.15, offsetY: 2-4). Use stronger shadows for modals and popovers (blur: 16-24, opacity: 0.15-0.25, offsetY: 8-16). Avoid harsh shadows with full black -- use low opacity (0.08-0.20) for natural-looking depth.",
    inputSchema: AddShadowInput,
  },
};
