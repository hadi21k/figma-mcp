import { z } from "zod";
import {
  NodeId,
  RGBAColor,
  Fill,
  StrokeConfig,
  Typography,
} from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreateFrameInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe("Frame name displayed in layers panel"),
    width: z.number().positive().max(100000).describe("Width in pixels"),
    height: z.number().positive().max(100000).describe("Height in pixels"),
    x: z.number().min(-100000).max(100000).default(0).describe("X position"),
    y: z.number().min(-100000).max(100000).default(0).describe("Y position"),
    fillColor: RGBAColor.optional().describe("Optional solid background fill"),
    parentId: NodeId.optional().describe("Parent frame/group ID"),
  })
  .strict();

export const CreateRectangleInput = z
  .object({
    name: z.string().max(500).default("Rectangle"),
    width: z.number().positive().max(100000),
    height: z.number().positive().max(100000),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    cornerRadius: z.number().min(0).max(10000).default(0),
    fills: z
      .array(Fill)
      .max(20)
      .default([
        {
          type: "SOLID",
          color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
          opacity: 1,
        },
      ]),
    stroke: StrokeConfig.optional(),
    opacity: z.number().min(0).max(1).default(1),
    parentId: NodeId.optional(),
  })
  .strict();

export const CreateEllipseInput = z
  .object({
    name: z.string().max(500).default("Ellipse"),
    width: z.number().positive().max(100000),
    height: z.number().positive().max(100000),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    fills: z
      .array(Fill)
      .max(20)
      .default([
        {
          type: "SOLID",
          color: { r: 0.85, g: 0.85, b: 0.85, a: 1 },
          opacity: 1,
        },
      ]),
    parentId: NodeId.optional(),
  })
  .strict();

export const CreateTextInput = z
  .object({
    name: z.string().max(500).default("Text"),
    content: z.string().min(1).max(100000).describe("Text string to display"),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    width: z
      .number()
      .positive()
      .max(100000)
      .optional()
      .describe("If set, enables text wrapping at this width"),
    typography: Typography.default({
      fontFamily: "Inter",
      fontStyle: "Regular",
      fontSize: 16,
      textAlign: "LEFT",
      letterSpacing: 0,
      lineHeight: { unit: "AUTO" },
    }),
    fills: z
      .array(Fill)
      .max(20)
      .default([
        { type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 },
      ]),
    parentId: NodeId.optional(),
  })
  .strict();

export const CREATE_TOOLS: Record<string, ToolDefinition> = {
  create_frame: {
    description: "Create a new frame container",
    inputSchema: CreateFrameInput,
  },
  create_rectangle: {
    description:
      "Create a rectangle with optional rounded corners, fills, stroke",
    inputSchema: CreateRectangleInput,
  },
  create_ellipse: {
    description: "Create an ellipse or circle",
    inputSchema: CreateEllipseInput,
  },
  create_text: {
    description: "Create a text node with typography settings",
    inputSchema: CreateTextInput,
  },
};
