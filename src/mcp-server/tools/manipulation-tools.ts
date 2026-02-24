import { z } from "zod";
import { NodeId, BlendMode } from "./shared-schemas.js";
import type { ToolDefinition } from "./index.js";

export const SetRotationInput = z
  .object({
    nodeId: NodeId,
    rotation: z
      .number()
      .min(-360)
      .max(360)
      .describe("Rotation angle in degrees. Positive = counter-clockwise."),
  })
  .strict();

export const SetBlendModeInput = z
  .object({
    nodeId: NodeId,
    blendMode: BlendMode.describe("Blend mode for layer compositing"),
  })
  .strict();

export const LockNodeInput = z
  .object({
    nodeId: NodeId,
    locked: z
      .boolean()
      .describe("true to lock the node, false to unlock"),
  })
  .strict();

export const MANIPULATION_TOOLS: Record<string, ToolDefinition> = {
  set_rotation: {
    description:
      "Set the rotation angle of a node in degrees. Positive values rotate counter-clockwise. Use for angled text, rotated decorative elements, or icon orientation. The node rotates around its center point.",
    inputSchema: SetRotationInput,
  },
  set_blend_mode: {
    description:
      "Set the blend mode of a node for layer compositing effects. Common modes: MULTIPLY for darkening overlays, SCREEN for lightening, OVERLAY for contrast. Use to create visual effects like color overlays on images, shadow layers, or artistic blending between elements.",
    inputSchema: SetBlendModeInput,
  },
  lock_node: {
    description:
      "Lock or unlock a node. Locked nodes cannot be selected or moved in the Figma UI, protecting them from accidental edits. Use to lock background layers, finalized headers, or template elements that should not be modified.",
    inputSchema: LockNodeInput,
  },
};
