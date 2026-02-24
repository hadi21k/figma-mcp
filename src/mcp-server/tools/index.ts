import { z } from "zod";
import { READ_TOOLS } from "./read-tools.js";
import { CREATE_TOOLS } from "./create-tools.js";
import { MODIFY_TOOLS } from "./modify-tools.js";
import { ORGANIZE_TOOLS } from "./organize-tools.js";
import { VIEWPORT_TOOLS } from "./viewport-tools.js";
import { STYLE_TOOLS } from "./style-tools.js";
import { LAYOUT_TOOLS } from "./layout-tools.js";
import { COMPONENT_TOOLS } from "./component-tools.js";
import { STYLE_SYSTEM_TOOLS } from "./style-system-tools.js";
import { IMAGE_TOOLS } from "./image-tools.js";
import { EXPORT_TOOLS } from "./export-tools.js";
import { TYPOGRAPHY_TOOLS } from "./typography-tools.js";
import { CONSTRAINT_TOOLS } from "./constraint-tools.js";
import { BATCH_TOOLS } from "./batch-tools.js";
import { VECTOR_TOOLS } from "./vector-tools.js";
import { PAGE_TOOLS } from "./page-tools.js";
import { TRAVERSAL_TOOLS } from "./traversal-tools.js";
import { VARIABLE_TOOLS } from "./variable-tools.js";
import { WORKFLOW_TOOLS } from "./workflow-tools.js";
import { DESIGN_SYSTEM_TOOLS } from "./design-system-tools.js";
import { MANIPULATION_TOOLS } from "./manipulation-tools.js";
import { EXTRA_SHAPE_TOOLS } from "./extra-shape-tools.js";

// ─── Tool Definition Interface ───────────────────────────────────────────────

export interface ToolDefinition {
  description: string;
  inputSchema: z.ZodObject<any>;
}

// ─── Merged Tool Registry ────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  ...READ_TOOLS,
  ...CREATE_TOOLS,
  ...MODIFY_TOOLS,
  ...ORGANIZE_TOOLS,
  ...VIEWPORT_TOOLS,
  ...STYLE_TOOLS,
  ...LAYOUT_TOOLS,
  ...COMPONENT_TOOLS,
  ...STYLE_SYSTEM_TOOLS,
  ...IMAGE_TOOLS,
  ...EXPORT_TOOLS,
  ...TYPOGRAPHY_TOOLS,
  ...CONSTRAINT_TOOLS,
  ...BATCH_TOOLS,
  ...VECTOR_TOOLS,
  ...PAGE_TOOLS,
  ...TRAVERSAL_TOOLS,
  ...VARIABLE_TOOLS,
  ...WORKFLOW_TOOLS,
  ...DESIGN_SYSTEM_TOOLS,
  ...MANIPULATION_TOOLS,
  ...EXTRA_SHAPE_TOOLS,
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
  DashPattern,
  StrokeCap,
  StrokeJoin,
  Effect,
  DropShadowEffect,
  InnerShadowEffect,
  LayerBlurEffect,
  BackgroundBlurEffect,
  LayoutSizing,
  LayoutAlign,
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
  CreateLineInput,
  CreatePolygonInput,
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
  CloneNodeInput,
  ReorderNodeInput,
} from "./organize-tools.js";

export { ZoomToNodeInput } from "./viewport-tools.js";

export {
  SetFillInput,
  SetStrokeInput,
  SetCornerRadiusInput,
  SetEffectsInput,
} from "./style-tools.js";

export { SetNodeLayoutPropertiesInput } from "./layout-tools.js";

export {
  CreateComponentInstanceInput,
  GetLocalComponentsInput,
  ListAvailableFontsInput,
} from "./component-tools.js";

export {
  CreatePaintStyleInput,
  CreateTextStyleInput,
  GetLocalStylesInput,
  ApplyStyleInput,
} from "./style-system-tools.js";

export {
  SetImageFillInput,
  SetImageFromUrlInput,
  SetImageFromPathInput,
} from "./image-tools.js";

export { ExportNodeInput } from "./export-tools.js";

export {
  SetTextDecorationInput,
  SetTextCaseInput,
  SetTextListInput,
} from "./typography-tools.js";

export { SetConstraintsInput, SetLayoutGridsInput } from "./constraint-tools.js";

export { BatchCreateInput, BatchUpdateInput } from "./batch-tools.js";

export {
  CreateVectorInput,
  CreateBooleanOperationInput,
} from "./vector-tools.js";

export { CreatePageInput, CreateSectionInput } from "./page-tools.js";

export { FindNodesInput } from "./traversal-tools.js";

export {
  CreateVariableCollectionInput,
  CreateVariableInput,
  BindVariableInput,
} from "./variable-tools.js";

export {
  FlattenNodeInput,
  UngroupNodesInput,
  SetSelectionInput,
  SetCurrentPageInput,
  CreateEffectStyleInput,
  GetVariablesInput,
} from "./workflow-tools.js";

export {
  CombineAsVariantsInput,
  DetachInstanceInput,
  SwapComponentInput,
  ImportComponentByKeyInput,
} from "./design-system-tools.js";

export {
  SetRotationInput,
  SetBlendModeInput,
  LockNodeInput,
} from "./manipulation-tools.js";

export {
  CreateStarInput,
  CreateSvgNodeInput,
  NotifyInput,
} from "./extra-shape-tools.js";
