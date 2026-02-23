import { z } from "zod";
import { NodeId, Fill, Typography } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreatePaintStyleInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "Style name, e.g. 'Primary/500', 'Neutral/Background', 'Brand/Blue'",
      ),
    paints: z
      .array(Fill)
      .min(1)
      .max(20)
      .describe("Fill paints that make up this style"),
  })
  .strict();

export const CreateTextStyleInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "Style name, e.g. 'Heading/H1', 'Body/Regular', 'Caption/Small'",
      ),
    typography: Typography.describe("Typography settings for this text style"),
  })
  .strict();

export const GetLocalStylesInput = z.object({}).strict();

export const ApplyStyleInput = z
  .object({
    nodeId: NodeId,
    fillStyleId: z
      .string()
      .optional()
      .describe("Paint style ID to apply as fill"),
    strokeStyleId: z
      .string()
      .optional()
      .describe("Paint style ID to apply as stroke"),
    textStyleId: z
      .string()
      .optional()
      .describe("Text style ID (only valid for TEXT nodes)"),
    effectStyleId: z
      .string()
      .optional()
      .describe("Effect style ID to apply effects"),
  })
  .strict();

export const STYLE_SYSTEM_TOOLS: Record<string, ToolDefinition> = {
  create_paint_style: {
    description:
      "Create a reusable color/paint style (design token). Use to define the color system: Primary, Secondary, Background, Surface, Text colors. Name styles using slash notation for organization (e.g. 'Brand/Primary', 'Neutral/100'). After creating styles, use apply_style to apply them to nodes.",
    inputSchema: CreatePaintStyleInput,
  },
  create_text_style: {
    description:
      "Create a reusable text style (typography token). Use to define the type system: Heading levels, Body, Caption, Label styles. Name styles using slash notation (e.g. 'Heading/H1', 'Body/Regular'). After creating styles, use apply_style to apply them to text nodes.",
    inputSchema: CreateTextStyleInput,
  },
  get_local_styles: {
    description:
      "List all local paint styles, text styles, and effect styles in the document. Returns style IDs, names, and types. Call this before using apply_style to find available styles. Essential for maintaining design consistency by reusing existing styles.",
    inputSchema: GetLocalStylesInput,
  },
  apply_style: {
    description:
      "Apply an existing style to a node by style ID. Use after get_local_styles to find the style ID. Applying styles keeps designs consistent and allows bulk updates when the style changes. For text nodes, textStyleId applies the full typography style.",
    inputSchema: ApplyStyleInput,
  },
};
