import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetTextDecorationInput = z
  .object({
    nodeId: NodeId,
    textDecoration: z
      .enum(["NONE", "UNDERLINE", "STRIKETHROUGH"])
      .describe("Text decoration style"),
  })
  .strict();

export const SetTextCaseInput = z
  .object({
    nodeId: NodeId,
    textCase: z
      .enum(["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS"])
      .describe("Text case transformation"),
  })
  .strict();

export const SetTextListInput = z
  .object({
    nodeId: NodeId,
    listType: z
      .enum(["UNORDERED", "ORDERED", "NONE"])
      .describe(
        "UNORDERED = bullet list, ORDERED = numbered list, NONE = remove list formatting",
      ),
  })
  .strict();

export const TYPOGRAPHY_TOOLS: Record<string, ToolDefinition> = {
  set_text_decoration: {
    description:
      "Set underline or strikethrough decoration on a text node. Use UNDERLINE for links and emphasis, STRIKETHROUGH for crossed-out prices or deleted content, NONE to remove decoration.",
    inputSchema: SetTextDecorationInput,
  },
  set_text_case: {
    description:
      "Set text case transformation on a text node. Use UPPER for all-caps labels and badges, TITLE for headings, LOWER for stylistic effects, SMALL_CAPS for elegant subheadings. The original text content is preserved -- only the visual rendering changes.",
    inputSchema: SetTextCaseInput,
  },
  set_text_list: {
    description:
      "Apply list formatting to a text node. Use UNORDERED for bullet lists (features, pros/cons), ORDERED for numbered lists (steps, rankings). The text node should contain newline-separated items for best results.",
    inputSchema: SetTextListInput,
  },
};
