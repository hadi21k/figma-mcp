import { z } from "zod";
import { NodeId, RGBAColor } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

const ConstraintAxis = z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]);

export const SetConstraintsInput = z
  .object({
    nodeId: NodeId,
    horizontal: ConstraintAxis.describe(
      "Horizontal pinning: MIN=left, CENTER=center, MAX=right, STRETCH=left+right, SCALE=proportional",
    ),
    vertical: ConstraintAxis.describe(
      "Vertical pinning: MIN=top, CENTER=center, MAX=bottom, STRETCH=top+bottom, SCALE=proportional",
    ),
  })
  .strict();

const LayoutGridObject = z
  .object({
    pattern: z
      .enum(["COLUMNS", "ROWS", "GRID"])
      .describe("Grid pattern type"),
    count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(12)
      .describe("Number of columns or rows"),
    gutterSize: z
      .number()
      .min(0)
      .max(1000)
      .default(16)
      .describe("Gap between columns/rows"),
    offset: z
      .number()
      .min(0)
      .max(1000)
      .default(0)
      .describe("Margin from the edge"),
    alignment: z
      .enum(["MIN", "MAX", "CENTER", "STRETCH"])
      .default("STRETCH")
      .describe("How the grid aligns within the frame"),
    sectionSize: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe("Column/row width for fixed-size grids"),
    color: RGBAColor.optional().describe("Grid line color (default: blue 10%)"),
    visible: z.boolean().default(true),
  })
  .strict();

export const SetLayoutGridsInput = z
  .object({
    nodeId: NodeId,
    grids: z
      .array(LayoutGridObject)
      .max(10)
      .describe(
        "Array of grid definitions. Common: 12-column grid with 16px gutters for web layouts.",
      ),
  })
  .strict();

export const CONSTRAINT_TOOLS: Record<string, ToolDefinition> = {
  set_constraints: {
    description:
      "Set pinning/resize constraints for a node inside a non-auto-layout frame. Controls responsive behavior: MIN pins to left/top, MAX pins to right/bottom, STRETCH fills the axis, CENTER stays centered, SCALE resizes proportionally. Essential for building responsive designs.",
    inputSchema: SetConstraintsInput,
  },
  set_layout_grids: {
    description:
      "Add column, row, or pixel grids to a frame for design alignment. Use COLUMNS with count=12 and gutterSize=16 for standard web layouts. ROWS for baseline grids. GRID for pixel grids. Multiple grids can be combined. Grids are visual guides only -- they don't affect exports.",
    inputSchema: SetLayoutGridsInput,
  },
};
