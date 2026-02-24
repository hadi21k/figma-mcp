import { z } from "zod";
import { NodeId, Fill, RGBAColor } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreateStarInput = z
  .object({
    name: z.string().max(500).default("Star"),
    pointCount: z
      .number()
      .int()
      .min(3)
      .max(20)
      .default(5)
      .describe("Number of outer points on the star"),
    innerRadius: z
      .number()
      .min(0.01)
      .max(0.99)
      .default(0.382)
      .describe("Inner radius ratio (0-1). 0.382 = golden ratio default."),
    width: z.number().positive().max(100000).default(100),
    height: z.number().positive().max(100000).default(100),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    fills: z.array(Fill).max(20).optional().describe("Fills for the star"),
    parentId: NodeId.optional().describe("Parent node ID"),
  })
  .strict();

export const CreateSvgNodeInput = z
  .object({
    svg: z
      .string()
      .min(1)
      .max(65536)
      .refine(
        (s) => !/<script[\s>]/i.test(s) && !/on\w+\s*=/i.test(s),
        { message: "SVG must not contain <script> tags or event handlers" },
      )
      .describe("SVG markup string (max 64KB). Must be valid SVG. No scripts or event handlers allowed."),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    name: z.string().max(500).optional().describe("Name for the created node"),
    parentId: NodeId.optional().describe("Parent node ID"),
  })
  .strict();

export const NotifyInput = z
  .object({
    message: z
      .string()
      .min(1)
      .max(500)
      .describe("Toast message text to display in Figma"),
    error: z
      .boolean()
      .default(false)
      .describe("If true, shows a red error-style toast"),
    timeout: z
      .number()
      .min(1000)
      .max(30000)
      .default(4000)
      .describe("Duration in milliseconds to show the toast"),
  })
  .strict();

export const EXTRA_SHAPE_TOOLS: Record<string, ToolDefinition> = {
  create_star: {
    description:
      "Create a star shape with configurable point count and inner radius. The innerRadius controls how 'pointy' the star is — 0.382 (golden ratio) gives a classic star, values closer to 1.0 make it more like a circle, values closer to 0 make extremely pointy stars.",
    inputSchema: CreateStarInput,
  },
  create_svg_node: {
    description:
      "Create a node from an SVG markup string. Figma parses the SVG and creates the corresponding vector node(s). Use to import icons, logos, or complex vector graphics from SVG source. The SVG string must be valid and under 64KB.",
    inputSchema: CreateSvgNodeInput,
  },
  notify: {
    description:
      "Show a toast notification in the Figma UI. Use to give the user feedback about completed operations, warnings, or status updates. Set error=true for red error-style toasts. The notification auto-dismisses after the timeout.",
    inputSchema: NotifyInput,
  },
};
