import { z } from "zod";
import { READ_TOOLS } from "./read-tools.js";
import { CREATE_TOOLS } from "./create-tools.js";
import { MODIFY_TOOLS } from "./modify-tools.js";
import { ORGANIZE_TOOLS } from "./organize-tools.js";
import { VIEWPORT_TOOLS } from "./viewport-tools.js";

// ─── Tool Definition Interface ───────────────────────────────────────────────

export interface ToolDefinition {
  description: string;
  inputSchema: z.AnyZodObject;
}

// ─── Merged Tool Registry ────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  ...READ_TOOLS,
  ...CREATE_TOOLS,
  ...MODIFY_TOOLS,
  ...ORGANIZE_TOOLS,
  ...VIEWPORT_TOOLS,
};

// ─── Re-exports ──────────────────────────────────────────────────────────────

export {
  NodeId,
  RGBAColor,
  SolidFill,
  GradientStop,
  GradientFill,
  Fill,
  StrokeConfig,
  LineHeight,
  Typography,
  Padding,
  AutoLayoutAlign,
} from "./shared-schemas.js";

export {
  GetDocumentInfoInput,
  GetSelectionInput,
  GetNodeInput,
} from "./read-tools.js";

export {
  CreateFrameInput,
  CreateRectangleInput,
  CreateEllipseInput,
  CreateTextInput,
} from "./create-tools.js";

export {
  SetAutoLayoutInput,
  UpdateTextInput,
  UpdateNodeInput,
  AddShadowInput,
} from "./modify-tools.js";

export {
  GroupNodesInput,
  DeleteNodeInput,
  CreateComponentInput,
} from "./organize-tools.js";

export { ZoomToNodeInput } from "./viewport-tools.js";
