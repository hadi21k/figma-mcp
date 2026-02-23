// Figma Plugin Sandbox — code.js
// Runs inside Figma's plugin sandbox with access to figma.* API
// Communicates with the UI iframe via figma.ui.postMessage / figma.ui.onmessage

// ─── Null-coalescing helper (Figma runtime is ES6, no ?? operator) ────────────

function nvl(val, fallback) {
  return val != null ? val : fallback;
}

// ─── Command Allowlist ───────────────────────────────────────────────────────

const ALLOWED_COMMANDS = new Set([
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
]);

function isAllowedCommand(cmd) {
  return ALLOWED_COMMANDS.has(cmd);
}

// ─── Request ID Validation ───────────────────────────────────────────────────

const REQUEST_ID_PATTERN = /^req_\d+_[a-z0-9]+$/;

function isValidRequestId(id) {
  return typeof id === "string" && REQUEST_ID_PATTERN.test(id);
}

// ─── Argument Validators ─────────────────────────────────────────────────────

function assertString(val, name) {
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (val.length > 10000) {
    throw new Error(`${name} exceeds maximum length`);
  }
  return val;
}

function assertNumber(val, name, min, max) {
  if (typeof val !== "number" || isNaN(val)) {
    throw new Error(`${name} must be a number`);
  }
  if (min !== undefined && val < min)
    throw new Error(`${name} must be >= ${min}`);
  if (max !== undefined && val > max)
    throw new Error(`${name} must be <= ${max}`);
  return val;
}

function assertOptionalString(val, name) {
  if (val === undefined || val === null) return undefined;
  return assertString(val, name);
}

function assertOptionalNumber(val, name, min, max) {
  if (val === undefined || val === null) return undefined;
  return assertNumber(val, name, min, max);
}

function assertOptionalBoolean(val, name) {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "boolean") throw new Error(`${name} must be a boolean`);
  return val;
}

function assertRGBA(val, name) {
  if (typeof val !== "object" || val === null) {
    throw new Error(`${name} must be an RGBA object`);
  }
  return {
    r: assertNumber(val.r, `${name}.r`, 0, 1),
    g: assertNumber(val.g, `${name}.g`, 0, 1),
    b: assertNumber(val.b, `${name}.b`, 0, 1),
    a: assertNumber(nvl(val.a, 1), `${name}.a`, 0, 1),
  };
}

function assertOptionalRGBA(val, name) {
  if (val === undefined || val === null) return undefined;
  return assertRGBA(val, name);
}

function assertFills(val, name) {
  if (!Array.isArray(val)) throw new Error(`${name} must be an array`);
  if (val.length > 20) throw new Error(`${name} exceeds maximum of 20 fills`);
  return val.map((f, i) => {
    if (typeof f !== "object" || f === null) {
      throw new Error(`${name}[${i}] must be an object`);
    }
    assertString(f.type, `${name}[${i}].type`);
    return f;
  });
}

function assertOptionalFills(val, name) {
  if (val === undefined || val === null) return undefined;
  return assertFills(val, name);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveParent(parentId) {
  if (!parentId) return figma.currentPage;
  const node = figma.getNodeById(parentId);
  if (!node) throw new Error(`Parent node ${parentId} not found`);
  if (!("appendChild" in node))
    throw new Error(`Node ${parentId} cannot contain children`);
  return node;
}

function findNode(nodeId) {
  const node = figma.getNodeById(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);
  return node;
}

function fillsToFigma(fills) {
  return fills.map((f) => {
    if (f.type === "SOLID" && f.color) {
      return {
        type: "SOLID",
        color: { r: f.color.r, g: f.color.g, b: f.color.b },
        opacity: f.color.a * nvl(f.opacity, 1),
      };
    }
    if (
      (f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL") &&
      f.gradientStops
    ) {
      return {
        type: f.type,
        gradientStops: f.gradientStops.map((s) => ({
          position: s.position,
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        })),
        gradientTransform: [
          [1, 0, 0],
          [0, 1, 0],
        ],
      };
    }
    throw new Error(`Unsupported fill type: ${f.type}`);
  });
}

function serializeNode(node) {
  const base = {
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

  if ("fills" in node && Array.isArray(node.fills)) base.fills = node.fills;
  if ("strokes" in node && Array.isArray(node.strokes))
    base.strokes = node.strokes;
  if ("cornerRadius" in node) base.cornerRadius = node.cornerRadius;

  if (node.type === "TEXT") {
    base.characters = node.characters;
    base.fontSize = node.fontSize === figma.mixed ? "MIXED" : node.fontSize;
    base.fontName = node.fontName === figma.mixed ? "MIXED" : node.fontName;
  }
  if ("layoutMode" in node) base.layoutMode = node.layoutMode;
  if ("children" in node) base.childCount = node.children.length;

  return base;
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleGetDocumentInfo(_args) {
  const pages = figma.root.children.map((page) => ({
    id: page.id,
    name: page.name,
    frames: page.children
      .filter((child) => child.type === "FRAME")
      .map(({ id, name, width, height, x, y }) => ({
        id,
        name,
        width,
        height,
        x,
        y,
      })),
  }));

  return {
    documentName: figma.root.name,
    pages,
    currentPageId: figma.currentPage.id,
    currentPageName: figma.currentPage.name,
  };
}

async function handleGetSelection(_args) {
  const selection = figma.currentPage.selection;
  return {
    selectionCount: selection.length,
    nodes: selection.map(serializeNode),
  };
}

async function handleGetNode(args) {
  const node = findNode(assertString(args.nodeId, "nodeId"));
  const result = serializeNode(node);

  if ("children" in node) {
    result.children = node.children.map(({ id, name, type }) => ({
      id,
      name,
      type,
    }));
  }

  return result;
}

async function handleCreateFrame(args) {
  const name = assertString(args.name, "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const fillColor = assertOptionalRGBA(args.fillColor, "fillColor");
  const parentId = assertOptionalString(args.parentId, "parentId");

  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(width, height);
  frame.x = x;
  frame.y = y;

  if (fillColor) {
    frame.fills = [
      {
        type: "SOLID",
        color: { r: fillColor.r, g: fillColor.g, b: fillColor.b },
        opacity: fillColor.a,
      },
    ];
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(frame);

  return { nodeId: frame.id, name: frame.name, type: "FRAME" };
}

async function handleSetAutoLayout(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const direction = assertString(args.direction, "direction");

  if (direction !== "HORIZONTAL" && direction !== "VERTICAL") {
    throw new Error("direction must be HORIZONTAL or VERTICAL");
  }

  const node = findNode(nodeId);
  if (node.type !== "FRAME" && node.type !== "COMPONENT") {
    throw new Error("Auto layout can only be set on frames or components");
  }

  node.layoutMode = direction;
  node.itemSpacing = assertNumber(nvl(args.gap, 0), "gap", 0, 10000);
  node.primaryAxisAlignItems = assertString(
    nvl(args.primaryAxisAlign, "MIN"),
    "primaryAxisAlign",
  );
  node.counterAxisAlignItems = assertString(
    nvl(args.counterAxisAlign, "MIN"),
    "counterAxisAlign",
  );

  const padding = args.padding;
  if (padding) {
    node.paddingTop = assertNumber(
      nvl(padding.top, 0),
      "padding.top",
      0,
      10000,
    );
    node.paddingRight = assertNumber(
      nvl(padding.right, 0),
      "padding.right",
      0,
      10000,
    );
    node.paddingBottom = assertNumber(
      nvl(padding.bottom, 0),
      "padding.bottom",
      0,
      10000,
    );
    node.paddingLeft = assertNumber(
      nvl(padding.left, 0),
      "padding.left",
      0,
      10000,
    );
  }

  return { nodeId: node.id, layoutMode: node.layoutMode };
}

async function handleCreateRectangle(args) {
  const name = assertString(nvl(args.name, "Rectangle"), "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const cornerRadius = assertNumber(
    nvl(args.cornerRadius, 0),
    "cornerRadius",
    0,
    10000,
  );
  const opacity = assertNumber(nvl(args.opacity, 1), "opacity", 0, 1);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;
  const stroke = args.stroke;

  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(width, height);
  rect.x = x;
  rect.y = y;
  rect.cornerRadius = cornerRadius;
  rect.opacity = opacity;

  if (fills) rect.fills = fillsToFigma(fills);

  if (stroke) {
    const strokeColor = assertRGBA(stroke.color, "stroke.color");
    const strokeWeight = assertNumber(
      nvl(stroke.weight, 1),
      "stroke.weight",
      0,
      100,
    );
    const strokeAlign = assertString(
      nvl(stroke.align, "INSIDE"),
      "stroke.align",
    );
    rect.strokes = [
      {
        type: "SOLID",
        color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b },
        opacity: strokeColor.a,
      },
    ];
    rect.strokeWeight = strokeWeight;
    rect.strokeAlign = strokeAlign;
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(rect);

  return { nodeId: rect.id, name: rect.name, type: "RECTANGLE" };
}

async function handleCreateEllipse(args) {
  const name = assertString(nvl(args.name, "Ellipse"), "name");
  const width = assertNumber(args.width, "width", 1, 100000);
  const height = assertNumber(args.height, "height", 1, 100000);
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  const ellipse = figma.createEllipse();
  ellipse.name = name;
  ellipse.resize(width, height);
  ellipse.x = x;
  ellipse.y = y;

  if (fills) ellipse.fills = fillsToFigma(fills);

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(ellipse);

  return { nodeId: ellipse.id, name: ellipse.name, type: "ELLIPSE" };
}

async function handleCreateText(args) {
  const name = assertString(nvl(args.name, "Text"), "name");
  const content = assertString(args.content, "content");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const width = assertOptionalNumber(args.width, "width", 1, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  const typo = nvl(args.typography, {});
  const fontFamily = assertString(
    nvl(typo.fontFamily, "Inter"),
    "typography.fontFamily",
  );
  const fontStyle = assertString(
    nvl(typo.fontStyle, "Regular"),
    "typography.fontStyle",
  );
  const fontSize = assertNumber(
    nvl(typo.fontSize, 16),
    "typography.fontSize",
    1,
    1000,
  );
  const textAlign = assertString(
    nvl(typo.textAlign, "LEFT"),
    "typography.textAlign",
  );
  const letterSpacing = assertNumber(
    nvl(typo.letterSpacing, 0),
    "typography.letterSpacing",
    -100,
    1000,
  );
  const lineHeight = typo.lineHeight;

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

  textNode.textAlignHorizontal = textAlign;
  textNode.letterSpacing = { value: letterSpacing, unit: "PIXELS" };

  if (lineHeight) {
    const unit = assertString(nvl(lineHeight.unit, "AUTO"), "lineHeight.unit");
    if (unit === "AUTO") {
      textNode.lineHeight = { unit: "AUTO" };
    } else if (unit === "PIXELS" || unit === "PERCENT") {
      textNode.lineHeight = {
        value: assertNumber(lineHeight.value, "lineHeight.value", 0),
        unit: unit,
      };
    }
  }

  if (fills) textNode.fills = fillsToFigma(fills);

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(textNode);

  return {
    nodeId: textNode.id,
    name: textNode.name,
    type: "TEXT",
    characters: textNode.characters,
  };
}

async function handleUpdateText(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const content = assertOptionalString(args.content, "content");
  const fills = assertOptionalFills(args.fills, "fills");

  const node = findNode(nodeId);
  if (node.type !== "TEXT")
    throw new Error(`Node ${nodeId} is not a TEXT node`);

  const fontName = node.fontName;
  await figma.loadFontAsync(fontName);

  if (content !== undefined) node.characters = content;

  const typo = args.typography;
  if (typo) {
    if (typo.fontFamily || typo.fontStyle) {
      const family = assertString(
        nvl(typo.fontFamily, fontName.family),
        "fontFamily",
      );
      const style = assertString(
        nvl(typo.fontStyle, fontName.style),
        "fontStyle",
      );
      await figma.loadFontAsync({ family: family, style: style });
      node.fontName = { family: family, style: style };
    }
    if (typo.fontSize !== undefined) {
      node.fontSize = assertNumber(typo.fontSize, "fontSize", 1, 1000);
    }
    if (typo.textAlign !== undefined) {
      node.textAlignHorizontal = assertString(typo.textAlign, "textAlign");
    }
    if (typo.letterSpacing !== undefined) {
      node.letterSpacing = {
        value: assertNumber(typo.letterSpacing, "letterSpacing"),
        unit: "PIXELS",
      };
    }
    if (typo.lineHeight !== undefined) {
      const lh = typo.lineHeight;
      const unit = assertString(lh.unit, "lineHeight.unit");
      if (unit === "AUTO") {
        node.lineHeight = { unit: "AUTO" };
      } else if (unit === "PIXELS" || unit === "PERCENT") {
        node.lineHeight = {
          value: assertNumber(lh.value, "lineHeight.value", 0),
          unit: unit,
        };
      }
    }
  }

  if (fills) node.fills = fillsToFigma(fills);

  return { nodeId: node.id, characters: node.characters };
}

async function handleUpdateNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  const updatedFields = [];

  const x = assertOptionalNumber(args.x, "x", -100000, 100000);
  const y = assertOptionalNumber(args.y, "y", -100000, 100000);
  const width = assertOptionalNumber(args.width, "width", 1, 100000);
  const height = assertOptionalNumber(args.height, "height", 1, 100000);
  const opacity = assertOptionalNumber(args.opacity, "opacity", 0, 1);
  const visible = assertOptionalBoolean(args.visible, "visible");
  const name = assertOptionalString(args.name, "name");
  const cornerRadius = assertOptionalNumber(
    args.cornerRadius,
    "cornerRadius",
    0,
    10000,
  );
  const fills = assertOptionalFills(args.fills, "fills");

  if (x !== undefined) {
    node.x = x;
    updatedFields.push("x");
  }
  if (y !== undefined) {
    node.y = y;
    updatedFields.push("y");
  }

  if ((width !== undefined || height !== undefined) && "resize" in node) {
    node.resize(nvl(width, node.width), nvl(height, node.height));
    if (width !== undefined) updatedFields.push("width");
    if (height !== undefined) updatedFields.push("height");
  }

  if (opacity !== undefined && "opacity" in node) {
    node.opacity = opacity;
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
    node.cornerRadius = cornerRadius;
    updatedFields.push("cornerRadius");
  }
  if (fills && "fills" in node) {
    node.fills = fillsToFigma(fills);
    updatedFields.push("fills");
  }

  return { nodeId: node.id, updatedFields: updatedFields };
}

async function handleAddShadow(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const color = assertRGBA(
    nvl(args.color, { r: 0, g: 0, b: 0, a: 0.25 }),
    "color",
  );
  const offsetX = assertNumber(nvl(args.offsetX, 0), "offsetX", -1000, 1000);
  const offsetY = assertNumber(nvl(args.offsetY, 4), "offsetY", -1000, 1000);
  const blur = assertNumber(nvl(args.blur, 8), "blur", 0, 1000);
  const spread = assertNumber(nvl(args.spread, 0), "spread", -1000, 1000);

  const node = findNode(nodeId);
  if (!("effects" in node))
    throw new Error(`Node ${nodeId} does not support effects`);

  const effects = node.effects.concat([
    {
      type: "DROP_SHADOW",
      color: { r: color.r, g: color.g, b: color.b, a: color.a },
      offset: { x: offsetX, y: offsetY },
      radius: blur,
      spread: spread,
      visible: true,
      blendMode: "NORMAL",
    },
  ]);
  node.effects = effects;

  return { nodeId: node.id, effectCount: node.effects.length };
}

async function handleGroupNodes(args) {
  if (!Array.isArray(args.nodeIds)) throw new Error("nodeIds must be an array");
  if (args.nodeIds.length < 2)
    throw new Error("nodeIds must contain at least 2 node IDs");

  const name = assertString(nvl(args.name, "Group"), "name");
  const nodes = args.nodeIds.map((id) => findNode(assertString(id, "nodeId")));
  const parent = nvl(nodes[0].parent, figma.currentPage);
  const group = figma.group(nodes, parent);
  group.name = name;

  return {
    groupNodeId: group.id,
    name: group.name,
    childCount: group.children.length,
  };
}

async function handleDeleteNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  findNode(nodeId).remove();
  return { deleted: true, nodeId: nodeId };
}

async function handleCreateComponent(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);

  if (!["FRAME", "GROUP", "RECTANGLE", "ELLIPSE", "TEXT"].includes(node.type)) {
    throw new Error(`Cannot convert ${node.type} to component`);
  }

  const component = figma.createComponent();
  component.name = node.name;
  component.resize(node.width, node.height);
  component.x = node.x;
  component.y = node.y;

  if ("children" in node) {
    const children = node.children.slice();
    for (let i = 0; i < children.length; i++) {
      component.appendChild(children[i]);
    }
  }
  if ("fills" in node) {
    component.fills = node.fills;
  }

  node.remove();

  return { componentId: component.id, name: component.name, type: "COMPONENT" };
}

async function handleZoomToNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  figma.viewport.scrollAndZoomIntoView([node]);

  return {
    nodeId: nodeId,
    viewport: {
      x: figma.viewport.center.x,
      y: figma.viewport.center.y,
      zoom: figma.viewport.zoom,
    },
  };
}

// ─── Handler Registry ────────────────────────────────────────────────────────

const handlers = {
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

// ─── Message Dispatcher ──────────────────────────────────────────────────────

function sendResponse(requestId, success, data, error) {
  figma.ui.postMessage(
    success
      ? { type: "RESPONSE", requestId: requestId, success: true, data: data }
      : {
          type: "RESPONSE",
          requestId: requestId,
          success: false,
          error: error,
        },
  );
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const DEFAULT_BRIDGE_URL = "ws://localhost:9001";

figma.showUI(__html__, { visible: true, width: 300, height: 240 });
console.log("[plugin] Figma MCP Bridge plugin loaded and ready");

(async () => {
  const saved = await figma.clientStorage.getAsync("bridgeUrl");
  const bridgeUrl =
    typeof saved === "string" && saved.length > 0 ? saved : DEFAULT_BRIDGE_URL;
  figma.ui.postMessage({ type: "INIT", bridgeUrl: bridgeUrl });
})();

figma.ui.onmessage = async (msg) => {
  if (typeof msg !== "object" || msg === null) return;

  if (msg.type === "SAVE_SETTINGS") {
    const url = msg.bridgeUrl;
    if (typeof url === "string" && url.length > 0) {
      await figma.clientStorage.setAsync("bridgeUrl", url);
      figma.ui.postMessage({ type: "INIT", bridgeUrl: url });
    }
    return;
  }

  if (msg.type !== "COMMAND") return;

  const requestId = msg.requestId;
  const command = msg.command;
  const args =
    typeof msg.args === "object" && msg.args !== null ? msg.args : {};

  if (!isValidRequestId(requestId)) {
    console.error("[plugin] Invalid requestId:", requestId);
    return;
  }

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
      message: "Unknown command: " + command,
    });
    return;
  }

  try {
    const data = await handlers[command](args);
    sendResponse(requestId, true, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      message.indexOf("not found") !== -1
        ? "NODE_NOT_FOUND"
        : message.indexOf("font") !== -1
          ? "FONT_UNAVAILABLE"
          : "EXECUTION_ERROR";
    sendResponse(requestId, false, undefined, { code: code, message: message });
  }
};
