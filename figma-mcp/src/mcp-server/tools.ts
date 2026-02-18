import { z } from "zod";

// ─── Shared Types ────────────────────────────────────────────────────────────

export const NodeId = z
  .string()
  .min(1)
  .max(100)
  .describe("Figma node ID, e.g. '123:456'");

export const RGBAColor = z
  .object({
    r: z.number().min(0).max(1).describe("Red channel 0-1"),
    g: z.number().min(0).max(1).describe("Green channel 0-1"),
    b: z.number().min(0).max(1).describe("Blue channel 0-1"),
    a: z.number().min(0).max(1).default(1).describe("Alpha channel 0-1"),
  })
  .strict();

export const SolidFill = z
  .object({
    type: z.literal("SOLID"),
    color: RGBAColor,
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

export const GradientStop = z
  .object({
    position: z.number().min(0).max(1),
    color: RGBAColor,
  })
  .strict();

export const GradientFill = z
  .object({
    type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL"]),
    gradientStops: z.array(GradientStop).min(2).max(20),
  })
  .strict();

export const Fill = z.discriminatedUnion("type", [SolidFill, GradientFill]);

export const StrokeConfig = z
  .object({
    color: RGBAColor,
    weight: z.number().positive().default(1),
    align: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).default("INSIDE"),
  })
  .strict();

export const LineHeight = z.union([
  z
    .object({ unit: z.literal("PIXELS"), value: z.number().positive() })
    .strict(),
  z
    .object({ unit: z.literal("PERCENT"), value: z.number().positive() })
    .strict(),
  z.object({ unit: z.literal("AUTO") }).strict(),
]);

export const Typography = z
  .object({
    fontFamily: z.string().max(200).default("Inter"),
    fontStyle: z.string().max(100).default("Regular"),
    fontSize: z.number().positive().max(1000).default(16),
    textAlign: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).default("LEFT"),
    letterSpacing: z.number().min(-100).max(1000).default(0),
    lineHeight: LineHeight.default({ unit: "AUTO" }),
  })
  .strict();

export const Padding = z
  .object({
    top: z.number().min(0).max(10000).default(0),
    right: z.number().min(0).max(10000).default(0),
    bottom: z.number().min(0).max(10000).default(0),
    left: z.number().min(0).max(10000).default(0),
  })
  .strict();

export const AutoLayoutAlign = z.enum([
  "MIN",
  "CENTER",
  "MAX",
  "SPACE_BETWEEN",
]);

// ─── Tool Input Schemas ──────────────────────────────────────────────────────

export const GetDocumentInfoInput = z.object({}).strict();

export const GetSelectionInput = z.object({}).strict();

export const GetNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

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

export const GroupNodesInput = z
  .object({
    nodeIds: z
      .array(NodeId)
      .min(2)
      .max(100)
      .describe("At least 2 node IDs to group"),
    name: z.string().max(500).default("Group"),
  })
  .strict();

export const DeleteNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

export const CreateComponentInput = z
  .object({
    nodeId: NodeId.describe("ID of existing node to convert to component"),
  })
  .strict();

export const ZoomToNodeInput = z
  .object({
    nodeId: NodeId,
  })
  .strict();

// ─── Tool Registry ───────────────────────────────────────────────────────────

export interface ToolDefinition {
  description: string;
  inputSchema: z.AnyZodObject;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  get_document_info: {
    description: "Get document metadata, pages, and top-level frames",
    inputSchema: GetDocumentInfoInput,
  },
  get_selection: {
    description: "Get all currently selected nodes with properties",
    inputSchema: GetSelectionInput,
  },
  get_node: {
    description: "Get detailed properties of a node by ID",
    inputSchema: GetNodeInput,
  },
  create_frame: {
    description: "Create a new frame container",
    inputSchema: CreateFrameInput,
  },
  set_auto_layout: {
    description: "Apply or update auto layout on a frame",
    inputSchema: SetAutoLayoutInput,
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
  group_nodes: {
    description: "Group multiple nodes together",
    inputSchema: GroupNodesInput,
  },
  delete_node: {
    description: "Delete a node from the document",
    inputSchema: DeleteNodeInput,
  },
  create_component: {
    description: "Convert an existing node into a reusable component",
    inputSchema: CreateComponentInput,
  },
  zoom_to_node: {
    description: "Scroll and zoom canvas to center on a node",
    inputSchema: ZoomToNodeInput,
  },
};
