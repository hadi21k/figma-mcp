import { z } from "zod";
import { NodeId } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const CreateVariableCollectionInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe("Collection name, e.g. 'Colors', 'Spacing', 'Typography'"),
    modes: z
      .array(z.string().min(1).max(200))
      .min(1)
      .max(10)
      .default(["Default"])
      .describe("Mode names, e.g. ['Light', 'Dark'] for color themes"),
  })
  .strict();

export const CreateVariableInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "Variable name, e.g. 'Primary', 'Spacing/4', 'Border/Radius/MD'",
      ),
    collectionId: z.string().min(1).describe("Variable collection ID"),
    type: z
      .enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"])
      .describe("Variable type"),
    values: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Values per mode, keyed by mode ID. e.g. { 'modeId1': { r:1,g:0,b:0,a:1 } }",
      ),
  })
  .strict();

export const BindVariableInput = z
  .object({
    nodeId: NodeId,
    property: z
      .string()
      .min(1)
      .describe(
        "Node property to bind, e.g. 'fills', 'opacity', 'cornerRadius', 'width', 'height'",
      ),
    variableId: z
      .string()
      .min(1)
      .describe("Variable ID to bind to the property"),
  })
  .strict();

export const VARIABLE_TOOLS: Record<string, ToolDefinition> = {
  create_variable_collection: {
    description:
      "Create a variable collection for design tokens. Collections group related variables and support multiple modes (e.g. Light/Dark themes). Use to build a systematic token system: Colors, Spacing, Typography, Border Radius.",
    inputSchema: CreateVariableCollectionInput,
  },
  create_variable: {
    description:
      "Create a design token variable (COLOR, FLOAT, STRING, BOOLEAN). Variables can be bound to node properties to enable theming. Use for semantic color tokens (Primary, Background, Text), spacing values (4, 8, 16, 24), and other design decisions.",
    inputSchema: CreateVariableInput,
  },
  bind_variable: {
    description:
      "Bind a variable to a node property so the property updates when the variable changes or mode switches. Use after creating variables to connect them to actual nodes. Essential for building theme-aware designs.",
    inputSchema: BindVariableInput,
  },
};
