// Figma Plugin Sandbox — code.ts
// This file runs inside Figma's plugin sandbox with access to figma.* API
// It communicates with the UI iframe via figma.ui.postMessage / figma.ui.onmessage

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommandMessage {
  type: "COMMAND";
  requestId: string;
  command: string;
  args: Record<string, unknown>;
}

interface ResponseMessage {
  type: "RESPONSE";
  requestId: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

type CommandHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

// ─── Command Allowlist ───────────────────────────────────────────────────────

const ALLOWED_COMMANDS = [
  "get_document_info",
  "get_selection",
  "get_node",
  "create_frame",
  "set_auto_layout",
  "create_rectangle",
  "create_ellipse",
  "create_text",
  "update_text",
  "update_node",
  "add_shadow",
  "group_nodes",
  "delete_node",
  "create_component",
  "zoom_to_node",
] as const;

type AllowedCommand = typeof ALLOWED_COMMANDS[number];

function isAllowedCommand(cmd: string): cmd is AllowedCommand {
  return (ALLOWED_COMMANDS as readonly string[]).includes(cmd);
}

// ─── Request ID Validation ───────────────────────────────────────────────────

const REQUEST_ID_PATTERN = /^req_\d+_[a-z0-9]+$/;

function isValidRequestId(id: unknown): id is string {
  return typeof id === "string" && REQUEST_ID_PATTERN.test(id);
}

// ─── Argument Validators ────────────────────────────────────────────────────

function assertString(val: unknown, name: string): string {
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (val.length > 10000) {
    throw new Error(`${name} exceeds maximum length`);
  }
  return val;
}

function assertNumber(val: unknown, name: string, min?: number, max?: number): number {
  if (typeof val !== "number" || isNaN(val)) {
    throw new Error(`${name} must be a number`);
  }
  if (min !== undefined && val < min) {
    throw new Error(`${name} must be >= ${min}`);
  }
  if (max !== undefined && val > max) {
    throw new Error(`${name} must be <= ${max}`);
  }
  return val;
}

function assertOptionalString(val: unknown, name: string): string | undefined {
  if (val === undefined || val === null) return undefined;
  return assertString(val, name);
}

function assertOptionalNumber(val: unknown, name: string, min?: number, max?: number): number | undefined {
  if (val === undefined || val === null) return undefined;
  return assertNumber(val, name, min, max);
}

function assertOptionalBoolean(val: unknown, name: string): boolean | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }
  return val;
}

interface RGBAInput {
  r: number;
  g: number;
  b: number;
  a: number;
}

function assertRGBA(val: unknown, name: string): RGBAInput {
  if (typeof val !== "object" || val === null) {
    throw new Error(`${name} must be an RGBA object`);
  }
  const obj = val as Record<string, unknown>;
  return {
    r: assertNumber(obj.r, `${name}.r`, 0, 1),
    g: assertNumber(obj.g, `${name}.g`, 0, 1),
    b: assertNumber(obj.b, `${name}.b`, 0, 1),
    a: assertNumber(obj.a ?? 1, `${name}.a`, 0, 1),
  };
}

function assertOptionalRGBA(val: unknown, name: string): RGBAInput | undefined {
  if (val === undefined || val === null) return undefined;
  return assertRGBA(val, name);
}

interface FillInput {
  type: string;
  color?: RGBAInput;
  opacity?: number;
  gradientStops?: Array<{ position: number; color: RGBAInput }>;
}

function assertFills(val: unknown, name: string): FillInput[] {
  if (!Array.isArray(val)) {
    throw new Error(`${name} must be an array`);
  }
  if (val.length > 20) {
    throw new Error(`${name} exceeds maximum of 20 fills`);
  }
  return val.map((f, i) => {
    if (typeof f !== "object" || f === null) {
      throw new Error(`${name}[${i}] must be an object`);
    }
    const fill = f as Record<string, unknown>;
    assertString(fill.type, `${name}[${i}].type`);
    return fill as unknown as FillInput;
  });
}

function assertOptionalFills(val: unknown, name: string): FillInput[] | undefined {
  if (val === undefined || val === null) return undefined;
  return assertFills(val, name);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveParent(parentId?: string): (FrameNode | GroupNode | PageNode) {
  if (!parentId) return figma.currentPage;
  const node = figma.getNodeById(parentId);
  if (!node) {
    throw new Error(`Parent node ${parentId} not found`);
  }
  if (!("appendChild" in node)) {
    throw new Error(`Node ${parentId} cannot contain children`);
  }
  return node as FrameNode | GroupNode;
}

function findNode(nodeId: string): SceneNode {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }
  return node as SceneNode;
}

function fillsToFigma(fills: FillInput[]): Paint[] {
  return fills.map((f) => {
    if (f.type === "SOLID" && f.color) {
      return {
        type: "SOLID" as const,
        color: { r: f.color.r, g: f.color.g, b: f.color.b },
        opacity: f.color.a * (f.opacity ?? 1),
      };
    }
    // Gradient support
    if ((f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL") && f.gradientStops) {
      return {
        type: f.type as "GRADIENT_LINEAR" | "GRADIENT_RADIAL",
        gradientStops: f.gradientStops.map((s) => ({
          position: s.position,
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        })),
        gradientTransform: [
          [1, 0, 0],
          [0, 1, 0],
        ] as Transform,
      };
    }
    return { type: "SOLID" as const, color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1 };
  });
}

function serializeNode(node: SceneNode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    visible: node.visible,
    opacity: "opacity" in node ? node.opacity : 1,
  };

  if ("fills" in node && Array.isArray(node.fills)) {
    base.fills = node.fills;
  }
  if ("strokes" in node && Array.isArray(node.strokes)) {
    base.strokes = node.strokes;
  }
  if ("cornerRadius" in node) {
    base.cornerRadius = node.cornerRadius;
  }
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    base.characters = textNode.characters;
    base.fontSize = textNode.fontSize;
    base.fontName = textNode.fontName;
  }
  if ("layoutMode" in node) {
    base.layoutMode = (node as FrameNode).layoutMode;
  }
  if ("children" in node) {
    base.childCount = (node as FrameNode).children.length;
  }

  return base;
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleGetDocumentInfo(_args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const doc = figma.root;
  const pages = doc.children.map((page) => ({
    id: page.id,
    name: page.name,
    frames: page.children
      .filter((child): child is FrameNode => child.type === "FRAME")
      .map((frame) => ({
        id: frame.id,
        name: frame.name,
        width: frame.width,
        height: frame.height,
        x: frame.x,
        y: frame.y,
      })),
  }));

  return {
    documentName: doc.name,
    pages,
    currentPageId: figma.currentPage.id,
    currentPageName: figma.currentPage.name,
  };
}

async function handleGetSelection(_args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const selection = figma.currentPage.selection;
  return {
    selectionCount: selection.length,
    nodes: selection.map(serializeNode),
  };
}

async function handleGetNode(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  const result = serializeNode(node);

  if ("children" in node) {
    result.children = (node as FrameNode).children.map((child) => ({
      id: child.id,
      name: child.name,
      type: child.type,
    }));
  }

  return result;
}

async function handleCreateFrame(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = assertString(args.name, "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(args.x ?? 0, "x", -100000, 100000);
  const y = assertNumber(args.y ?? 0, "y", -100000, 100000);
  const fillColor = assertOptionalRGBA(args.fillColor, "fillColor");
  const parentId = assertOptionalString(args.parentId, "parentId");

  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(width, height);
  frame.x = x;
  frame.y = y;

  if (fillColor) {
    frame.fills = [{
      type: "SOLID",
      color: { r: fillColor.r, g: fillColor.g, b: fillColor.b },
      opacity: fillColor.a,
    }];
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) {
    parent.appendChild(frame);
  }

  return { nodeId: frame.id, name: frame.name, type: "FRAME" };
}

async function handleSetAutoLayout(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const direction = assertString(args.direction, "direction");
  const gap = assertNumber(args.gap ?? 0, "gap", 0, 10000);
  const padding = args.padding as Record<string, unknown> | undefined;
  const primaryAxisAlign = assertString(args.primaryAxisAlign ?? "MIN", "primaryAxisAlign");
  const counterAxisAlign = assertString(args.counterAxisAlign ?? "MIN", "counterAxisAlign");

  if (direction !== "HORIZONTAL" && direction !== "VERTICAL") {
    throw new Error("direction must be HORIZONTAL or VERTICAL");
  }

  const node = findNode(nodeId);
  if (node.type !== "FRAME" && node.type !== "COMPONENT") {
    throw new Error("Auto layout can only be set on frames or components");
  }

  const frame = node as FrameNode;
  frame.layoutMode = direction;
  frame.itemSpacing = gap;

  if (padding) {
    frame.paddingTop = assertNumber(padding.top ?? 0, "padding.top", 0, 10000);
    frame.paddingRight = assertNumber(padding.right ?? 0, "padding.right", 0, 10000);
    frame.paddingBottom = assertNumber(padding.bottom ?? 0, "padding.bottom", 0, 10000);
    frame.paddingLeft = assertNumber(padding.left ?? 0, "padding.left", 0, 10000);
  }

  frame.primaryAxisAlignItems = primaryAxisAlign as "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  frame.counterAxisAlignItems = counterAxisAlign as "MIN" | "CENTER" | "MAX";

  return { nodeId: frame.id, layoutMode: frame.layoutMode };
}

async function handleCreateRectangle(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = assertString(args.name ?? "Rectangle", "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(args.x ?? 0, "x", -100000, 100000);
  const y = assertNumber(args.y ?? 0, "y", -100000, 100000);
  const cornerRadius = assertNumber(args.cornerRadius ?? 0, "cornerRadius", 0, 10000);
  const opacity = assertNumber(args.opacity ?? 1, "opacity", 0, 1);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;
  const stroke = args.stroke as Record<string, unknown> | undefined;

  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(width, height);
  rect.x = x;
  rect.y = y;
  rect.cornerRadius = cornerRadius;
  rect.opacity = opacity;

  if (fills) {
    rect.fills = fillsToFigma(fills);
  }

  if (stroke) {
    const strokeColor = assertRGBA(stroke.color, "stroke.color");
    const strokeWeight = assertNumber(stroke.weight ?? 1, "stroke.weight", 0, 100);
    const strokeAlign = assertString(stroke.align ?? "INSIDE", "stroke.align");
    rect.strokes = [{
      type: "SOLID",
      color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b },
      opacity: strokeColor.a,
    }];
    rect.strokeWeight = strokeWeight;
    rect.strokeAlign = strokeAlign as "INSIDE" | "OUTSIDE" | "CENTER";
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) {
    parent.appendChild(rect);
  }

  return { nodeId: rect.id, name: rect.name, type: "RECTANGLE" };
}

async function handleCreateEllipse(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = assertString(args.name ?? "Ellipse", "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(args.x ?? 0, "x", -100000, 100000);
  const y = assertNumber(args.y ?? 0, "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  const ellipse = figma.createEllipse();
  ellipse.name = name;
  ellipse.resize(width, height);
  ellipse.x = x;
  ellipse.y = y;

  if (fills) {
    ellipse.fills = fillsToFigma(fills);
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) {
    parent.appendChild(ellipse);
  }

  return { nodeId: ellipse.id, name: ellipse.name, type: "ELLIPSE" };
}

async function handleCreateText(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = assertString(args.name ?? "Text", "name");
  const content = assertString(args.content, "content");
  const x = assertNumber(args.x ?? 0, "x", -100000, 100000);
  const y = assertNumber(args.y ?? 0, "y", -100000, 100000);
  const width = assertOptionalNumber(args.width, "width", 1, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  const typo = (args.typography ?? {}) as Record<string, unknown>;
  const fontFamily = assertString(typo.fontFamily ?? "Inter", "typography.fontFamily");
  const fontStyle = assertString(typo.fontStyle ?? "Regular", "typography.fontStyle");
  const fontSize = assertNumber(typo.fontSize ?? 16, "typography.fontSize", 1, 1000);
  const textAlign = assertString(typo.textAlign ?? "LEFT", "typography.textAlign");
  const letterSpacing = assertNumber(typo.letterSpacing ?? 0, "typography.letterSpacing", -100, 1000);
  const lineHeight = typo.lineHeight as Record<string, unknown> | undefined;

  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  const textNode = figma.createText();
  textNode.name = name;
  textNode.x = x;
  textNode.y = y;
  textNode.fontName = { family: fontFamily, style: fontStyle };
  textNode.fontSize = fontSize;
  textNode.characters = content;

  if (width !== undefined) {
    textNode.textAutoResize = "HEIGHT";
    textNode.resize(width, textNode.height);
  }

  textNode.textAlignHorizontal = textAlign as "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textNode.letterSpacing = { value: letterSpacing, unit: "PIXELS" };

  if (lineHeight) {
    const unit = assertString(lineHeight.unit ?? "AUTO", "lineHeight.unit");
    if (unit === "AUTO") {
      textNode.lineHeight = { unit: "AUTO" };
    } else if (unit === "PIXELS") {
      textNode.lineHeight = { value: assertNumber(lineHeight.value, "lineHeight.value", 0), unit: "PIXELS" };
    } else if (unit === "PERCENT") {
      textNode.lineHeight = { value: assertNumber(lineHeight.value, "lineHeight.value", 0), unit: "PERCENT" };
    }
  }

  if (fills) {
    textNode.fills = fillsToFigma(fills);
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) {
    parent.appendChild(textNode);
  }

  return { nodeId: textNode.id, name: textNode.name, type: "TEXT", characters: textNode.characters };
}

async function handleUpdateText(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const content = assertOptionalString(args.content, "content");
  const fills = assertOptionalFills(args.fills, "fills");

  const node = findNode(nodeId);
  if (node.type !== "TEXT") {
    throw new Error(`Node ${nodeId} is not a TEXT node`);
  }
  const textNode = node as TextNode;

  // Ensure font is loaded before modifying
  const fontName = textNode.fontName as FontName;
  await figma.loadFontAsync(fontName);

  if (content !== undefined) {
    textNode.characters = content;
  }

  const typo = args.typography as Record<string, unknown> | undefined;
  if (typo) {
    if (typo.fontFamily || typo.fontStyle) {
      const family = assertString(typo.fontFamily ?? fontName.family, "fontFamily");
      const style = assertString(typo.fontStyle ?? fontName.style, "fontStyle");
      await figma.loadFontAsync({ family, style });
      textNode.fontName = { family, style };
    }
    if (typo.fontSize !== undefined) {
      textNode.fontSize = assertNumber(typo.fontSize, "fontSize", 1, 1000);
    }
    if (typo.textAlign !== undefined) {
      textNode.textAlignHorizontal = assertString(typo.textAlign, "textAlign") as "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    }
    if (typo.letterSpacing !== undefined) {
      textNode.letterSpacing = { value: assertNumber(typo.letterSpacing, "letterSpacing"), unit: "PIXELS" };
    }
    if (typo.lineHeight !== undefined) {
      const lh = typo.lineHeight as Record<string, unknown>;
      const unit = assertString(lh.unit, "lineHeight.unit");
      if (unit === "AUTO") {
        textNode.lineHeight = { unit: "AUTO" };
      } else if (unit === "PIXELS") {
        textNode.lineHeight = { value: assertNumber(lh.value, "lineHeight.value", 0), unit: "PIXELS" };
      } else if (unit === "PERCENT") {
        textNode.lineHeight = { value: assertNumber(lh.value, "lineHeight.value", 0), unit: "PERCENT" };
      }
    }
  }

  if (fills) {
    textNode.fills = fillsToFigma(fills);
  }

  return { nodeId: textNode.id, characters: textNode.characters };
}

async function handleUpdateNode(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  const updatedFields: string[] = [];

  const x = assertOptionalNumber(args.x, "x", -100000, 100000);
  const y = assertOptionalNumber(args.y, "y", -100000, 100000);
  const width = assertOptionalNumber(args.width, "width", 1, 100000);
  const height = assertOptionalNumber(args.height, "height", 1, 100000);
  const opacity = assertOptionalNumber(args.opacity, "opacity", 0, 1);
  const visible = assertOptionalBoolean(args.visible, "visible");
  const name = assertOptionalString(args.name, "name");
  const cornerRadius = assertOptionalNumber(args.cornerRadius, "cornerRadius", 0, 10000);
  const fills = assertOptionalFills(args.fills, "fills");

  if (x !== undefined) { node.x = x; updatedFields.push("x"); }
  if (y !== undefined) { node.y = y; updatedFields.push("y"); }
  if (width !== undefined || height !== undefined) {
    const w = width ?? node.width;
    const h = height ?? node.height;
    if ("resize" in node) {
      (node as FrameNode).resize(w, h);
      if (width !== undefined) updatedFields.push("width");
      if (height !== undefined) updatedFields.push("height");
    }
  }
  if (opacity !== undefined && "opacity" in node) {
    (node as FrameNode).opacity = opacity;
    updatedFields.push("opacity");
  }
  if (visible !== undefined) {
    node.visible = visible;
    updatedFields.push("visible");
  }
  if (name !== undefined) {
    node.name = name;
    updatedFields.push("name");
  }
  if (cornerRadius !== undefined && "cornerRadius" in node) {
    (node as RectangleNode).cornerRadius = cornerRadius;
    updatedFields.push("cornerRadius");
  }
  if (fills && "fills" in node) {
    (node as RectangleNode).fills = fillsToFigma(fills);
    updatedFields.push("fills");
  }

  return { nodeId: node.id, updatedFields };
}

async function handleAddShadow(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const color = assertRGBA(args.color ?? { r: 0, g: 0, b: 0, a: 0.25 }, "color");
  const offsetX = assertNumber(args.offsetX ?? 0, "offsetX", -1000, 1000);
  const offsetY = assertNumber(args.offsetY ?? 4, "offsetY", -1000, 1000);
  const blur = assertNumber(args.blur ?? 8, "blur", 0, 1000);
  const spread = assertNumber(args.spread ?? 0, "spread", -1000, 1000);

  const node = findNode(nodeId);
  if (!("effects" in node)) {
    throw new Error(`Node ${nodeId} does not support effects`);
  }

  const blendableNode = node as FrameNode;
  const existingEffects = [...blendableNode.effects];
  existingEffects.push({
    type: "DROP_SHADOW",
    color: { r: color.r, g: color.g, b: color.b, a: color.a },
    offset: { x: offsetX, y: offsetY },
    radius: blur,
    spread: spread,
    visible: true,
    blendMode: "NORMAL",
  });
  blendableNode.effects = existingEffects;

  return { nodeId: node.id, effectCount: blendableNode.effects.length };
}

async function handleGroupNodes(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!Array.isArray(args.nodeIds)) {
    throw new Error("nodeIds must be an array");
  }
  if (args.nodeIds.length < 2) {
    throw new Error("nodeIds must contain at least 2 node IDs");
  }

  const name = assertString(args.name ?? "Group", "name");
  const nodes: SceneNode[] = [];
  for (const id of args.nodeIds) {
    nodes.push(findNode(assertString(id, "nodeId")));
  }

  const group = figma.group(nodes, figma.currentPage);
  group.name = name;

  return { groupNodeId: group.id, name: group.name, childCount: group.children.length };
}

async function handleDeleteNode(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  node.remove();
  return { deleted: true, nodeId };
}

async function handleCreateComponent(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);

  if (node.type !== "FRAME" && node.type !== "GROUP" && node.type !== "RECTANGLE" &&
      node.type !== "ELLIPSE" && node.type !== "TEXT") {
    throw new Error(`Cannot convert ${node.type} to component`);
  }

  const component = figma.createComponent();
  component.name = node.name;
  component.resize(node.width, node.height);
  component.x = node.x;
  component.y = node.y;

  // Move children if it's a frame/group
  if ("children" in node) {
    const children = [...(node as FrameNode).children];
    for (const child of children) {
      component.appendChild(child);
    }
  }

  // Copy fills if applicable
  if ("fills" in node) {
    component.fills = (node as FrameNode).fills;
  }

  // Remove original node
  node.remove();

  return { componentId: component.id, name: component.name, type: "COMPONENT" };
}

async function handleZoomToNode(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  figma.viewport.scrollAndZoomIntoView([node]);

  return {
    nodeId,
    viewport: {
      x: figma.viewport.center.x,
      y: figma.viewport.center.y,
      zoom: figma.viewport.zoom,
    },
  };
}

// ─── Handler Registry ────────────────────────────────────────────────────────

const handlers: Record<AllowedCommand, CommandHandler> = {
  get_document_info: handleGetDocumentInfo,
  get_selection: handleGetSelection,
  get_node: handleGetNode,
  create_frame: handleCreateFrame,
  set_auto_layout: handleSetAutoLayout,
  create_rectangle: handleCreateRectangle,
  create_ellipse: handleCreateEllipse,
  create_text: handleCreateText,
  update_text: handleUpdateText,
  update_node: handleUpdateNode,
  add_shadow: handleAddShadow,
  group_nodes: handleGroupNodes,
  delete_node: handleDeleteNode,
  create_component: handleCreateComponent,
  zoom_to_node: handleZoomToNode,
};

// ─── Message Dispatcher ─────────────────────────────────────────────────────

function sendResponse(
  requestId: string,
  success: boolean,
  data?: Record<string, unknown>,
  error?: { code: string; message: string },
): void {
  const response: ResponseMessage = success
    ? { type: "RESPONSE", requestId, success: true, data }
    : { type: "RESPONSE", requestId, success: false, error };

  figma.ui.postMessage(response);
}

figma.showUI(__html__, { visible: false, width: 300, height: 200 });

figma.ui.onmessage = async (msg: unknown) => {
  if (typeof msg !== "object" || msg === null) return;

  const message = msg as Record<string, unknown>;
  if (message.type !== "COMMAND") return;

  const requestId = message.requestId;
  if (!isValidRequestId(requestId)) {
    console.error("[plugin] Invalid requestId:", requestId);
    return;
  }

  const command = message.command;
  if (typeof command !== "string") {
    sendResponse(requestId, false, undefined, {
      code: "INVALID_ARGS",
      message: "command must be a string",
    });
    return;
  }

  if (!isAllowedCommand(command)) {
    sendResponse(requestId, false, undefined, {
      code: "COMMAND_NOT_FOUND",
      message: `Unknown command: ${command}`,
    });
    return;
  }

  const args = (typeof message.args === "object" && message.args !== null)
    ? message.args as Record<string, unknown>
    : {};

  const handler = handlers[command];

  try {
    const data = await handler(args);
    sendResponse(requestId, true, data);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const code = errMessage.includes("not found") ? "NODE_NOT_FOUND"
      : errMessage.includes("font") ? "FONT_UNAVAILABLE"
      : "EXECUTION_ERROR";
    sendResponse(requestId, false, undefined, { code, message: errMessage });
  }
};
