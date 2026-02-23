import { z } from "zod";
import {
  NodeId,
  Fill,
  RGBAColor,
  StrokeConfig,
  DashPattern,
  StrokeCap,
  StrokeJoin,
  Effect,
} from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetFillInput = z
  .object({
    nodeId: NodeId,
    fills: z
      .array(Fill)
      .max(20)
      .describe(
        "Array of fill objects. Replaces all existing fills. Use empty array to remove all fills.",
      ),
  })
  .strict();

export const SetStrokeInput = z
  .object({
    nodeId: NodeId,
    strokes: z
      .array(
        z
          .object({
            color: RGBAColor,
            opacity: z.number().min(0).max(1).default(1),
          })
          .strict(),
      )
      .max(10)
      .optional()
      .describe("Stroke paint colors. Pass empty array to remove strokes."),
    strokeWeight: z.number().positive().max(100).default(1),
    strokeAlign: z
      .enum(["INSIDE", "OUTSIDE", "CENTER"])
      .default("INSIDE")
      .describe("Where the stroke is drawn relative to the boundary"),
    dashPattern: DashPattern.optional().describe(
      "Alternating dash/gap lengths for dashed strokes, e.g. [8, 4]",
    ),
    strokeCap: StrokeCap.optional().describe(
      "Shape of line endpoints (for open paths and lines)",
    ),
    strokeJoin: StrokeJoin.optional().describe("Shape of line corners"),
  })
  .strict();

export const SetCornerRadiusInput = z
  .object({
    nodeId: NodeId,
    topLeft: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("Top-left corner radius"),
    topRight: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("Top-right corner radius"),
    bottomRight: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("Bottom-right corner radius"),
    bottomLeft: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("Bottom-left corner radius"),
    cornerSmoothing: z
      .number()
      .min(0)
      .max(1)
      .default(0)
      .describe(
        "iOS-style corner smoothing (0 = standard, 0.6 = iOS smooth, 1 = fully smooth)",
      ),
  })
  .strict();

export const SetEffectsInput = z
  .object({
    nodeId: NodeId,
    effects: z
      .array(Effect)
      .max(20)
      .describe(
        "Array of effects (DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR). Replaces all existing effects.",
      ),
  })
  .strict();

export const STYLE_TOOLS: Record<string, ToolDefinition> = {
  set_fill: {
    description:
      "Set fills on any node. Supports solid colors and gradients. Replaces all existing fills. Use for precise color control beyond what update_node offers. Pass an empty fills array to remove all fills from a node.",
    inputSchema: SetFillInput,
  },
  set_stroke: {
    description:
      "Set stroke (border/outline) on a node. Supports solid colors, dash patterns, custom line caps and joins. Use for button borders, card outlines, dividers, and decorative borders. Set dashPattern for dashed borders.",
    inputSchema: SetStrokeInput,
  },
  set_corner_radius: {
    description:
      "Set individual corner radii on a rectangle or frame. Use for asymmetric rounding like speech bubbles, custom button shapes, or design system components with specific rounding. Set cornerSmoothing to 0.6 for iOS-style smooth corners.",
    inputSchema: SetCornerRadiusInput,
  },
  set_effects: {
    description:
      "Set visual effects on a node. Supports DROP_SHADOW (depth/elevation), INNER_SHADOW (inset depth), LAYER_BLUR (blur the element), BACKGROUND_BLUR (frosted glass effect -- blurs content behind the node). Replaces all existing effects. Use BACKGROUND_BLUR for modern glass morphism UI patterns.",
    inputSchema: SetEffectsInput,
  },
};
