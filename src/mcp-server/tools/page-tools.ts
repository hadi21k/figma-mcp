import { z } from "zod";
import { RGBAColor } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreatePageInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .default("Page")
      .describe("Name for the new page"),
  })
  .strict();

export const CreateSectionInput = z
  .object({
    name: z.string().min(1).max(500).default("Section"),
    x: z.number().min(-100000).max(100000).default(0),
    y: z.number().min(-100000).max(100000).default(0),
    width: z.number().positive().max(100000).default(800),
    height: z.number().positive().max(100000).default(600),
    fillColor: RGBAColor.optional().describe(
      "Background fill color for the section",
    ),
  })
  .strict();

export const PAGE_TOOLS: Record<string, ToolDefinition> = {
  create_page: {
    description:
      "Create a new page in the Figma document. Use to organize designs by screen, feature, or design phase (e.g. 'Mobile', 'Desktop', 'Components', 'Prototype'). Returns the new page ID.",
    inputSchema: CreatePageInput,
  },
  create_section: {
    description:
      "Create a section on the canvas to organize frames and content. Sections are like colored regions that group related frames visually. Use to organize a canvas with many frames by feature, flow, or design state.",
    inputSchema: CreateSectionInput,
  },
};
