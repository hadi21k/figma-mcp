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
      .describe(
        "Semantic name for the frame (e.g. 'LoginCard', 'NavBar', 'HeroSection') -- avoid generic names like 'Frame 1'",
      ),
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
    name: z
      .string()
      .max(500)
      .default("Rectangle")
      .describe(
        "Name for the rectangle layer -- use descriptive names like 'BackgroundFill', 'Divider', 'AvatarPlaceholder'",
      ),
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
    content: z
      .string()
      .min(1)
      .max(100000)
      .describe(
        "The actual text to display. Use realistic content that matches the design context -- avoid lorem ipsum",
      ),
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

export const CreateLineInput = z
  .object({
    name: z.string().max(500).default("Line"),
    x: z
      .number()
      .min(-100000)
      .max(100000)
      .default(0)
      .describe("Start X position"),
    y: z
      .number()
      .min(-100000)
      .max(100000)
      .default(0)
      .describe("Start Y position"),
    length: z
      .number()
      .positive()
      .max(100000)
      .default(100)
      .describe("Length of the line in pixels"),
    rotation: z
      .number()
      .min(-360)
      .max(360)
      .default(0)
      .describe("Rotation angle in degrees"),
    strokeColor: RGBAColor.default({ r: 0, g: 0, b: 0, a: 1 }),
    strokeWeight: z.number().positive().max(100).default(1),
    parentId: NodeId.optional(),
  })
  .strict();

export const CreatePolygonInput = z
  .object({
    name: z.string().max(500).default("Polygon"),
    pointCount: z
      .number()
      .int()
      .min(3)
      .max(20)
      .default(3)
      .describe("Number of sides (3 = triangle, 6 = hexagon, etc.)"),
    width: z.number().positive().max(100000).default(100),
    height: z.number().positive().max(100000).default(100),
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

export const CREATE_TOOLS: Record<string, ToolDefinition> = {
  create_frame: {
    description:
      "Create a layout frame -- the primary building block for all UI design. Use frames for screens, cards, navbars, sections, modals, and any container that holds other elements. Always apply set_auto_layout after creating a frame to enable proper spacing and alignment. Name frames semantically (e.g. 'Header', 'CardContainer', 'Sidebar') -- never use generic names like 'Frame 1'.",
    inputSchema: CreateFrameInput,
  },
  create_rectangle: {
    description:
      "Create a rectangle shape node. Use ONLY for decorative or visual elements like background fills, dividers, color swatches, placeholder images, or decorative shapes. Do NOT use rectangles to build UI components -- use create_frame with auto-layout instead. For example, a button is a frame with auto-layout and text inside, NOT a rectangle with text on top.",
    inputSchema: CreateRectangleInput,
  },
  create_ellipse: {
    description:
      "Create an ellipse or circle shape. Use for avatars, status indicators, decorative circles, icons, or circular backgrounds. Do NOT use to build UI components -- use create_frame with cornerRadius for rounded UI elements instead.",
    inputSchema: CreateEllipseInput,
  },
  create_text: {
    description:
      "Create a text node with typography settings. Always place text inside a parent frame with auto-layout for proper alignment and spacing. Use meaningful content -- avoid placeholder text like 'Lorem ipsum' unless specifically requested. Set appropriate typography (fontSize, fontFamily, fontStyle) to match the design hierarchy: headings (24-48px bold), body (14-16px regular), captions (12px regular).",
    inputSchema: CreateTextInput,
  },
  create_line: {
    description:
      "Create a line shape. Use for dividers, separators, underlines, or decorative strokes. Specify length and rotation for diagonal lines. Set strokeWeight for line thickness.",
    inputSchema: CreateLineInput,
  },
  create_polygon: {
    description:
      "Create a regular polygon shape. Use for decorative elements, icons, or geometric shapes. pointCount=3 creates a triangle, pointCount=6 creates a hexagon.",
    inputSchema: CreatePolygonInput,
  },
};
