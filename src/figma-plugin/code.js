// Figma Plugin Sandbox — code.js
// Runs inside Figma's plugin sandbox with access to figma.* API
// Communicates with the UI iframe via figma.ui.postMessage / figma.ui.onmessage
//
// ALLOWED_COMMANDS source of truth: src/shared/constants.ts → COMMAND_NAMES

// ─── Lightweight Logger (no Node.js / pino in Figma sandbox) ─────────────────

var LOG_LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };
var CURRENT_LOG_LEVEL = LOG_LEVELS.info;

function pluginLog(level, msg, data) {
  if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < CURRENT_LOG_LEVEL) return;
  var entry = "[plugin:" + level + "] " + msg;
  if (data) entry += " " + JSON.stringify(data);
  if (level === "error" || level === "fatal") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

// ─── Null-coalescing helper (Figma runtime is ES6, no ?? operator) ────────────

function nvl(val, fallback) {
  return val != null ? val : fallback;
}

// ─── Command Allowlist ───────────────────────────────────────────────────────

const ALLOWED_COMMANDS = new Set([
  // Read
  "get_document_info",
  "get_selection",
  "get_node",
  // Create
  "create_frame",
  "create_rectangle",
  "create_ellipse",
  "create_text",
  "create_line",
  "create_polygon",
  // Modify
  "set_auto_layout",
  "update_text",
  "update_node",
  "add_shadow",
  // Style
  "set_fill",
  "set_stroke",
  "set_corner_radius",
  "set_effects",
  // Layout
  "set_node_layout_properties",
  // Organize
  "group_nodes",
  "delete_node",
  "create_component",
  "clone_node",
  "reorder_node",
  // Component
  "create_component_instance",
  "get_local_components",
  "list_available_fonts",
  // Viewport
  "zoom_to_node",
  // Phase 2: Style system
  "create_paint_style",
  "create_text_style",
  "get_local_styles",
  "apply_style",
  // Phase 2: Image
  "set_image_fill",
  // Phase 2: Export
  "export_node",
  // Phase 2: Typography
  "set_text_decoration",
  "set_text_case",
  "set_text_list",
  // Phase 2: Constraints & grids
  "set_constraints",
  "set_layout_grids",
  // Phase 3: Batch
  "batch_create",
  "batch_update",
  // Phase 3: Vector
  "create_vector",
  "create_boolean_operation",
  // Phase 3: Pages
  "create_page",
  "create_section",
  // Phase 3: Traversal
  "find_nodes",
  // Phase 3: Variables
  "create_variable_collection",
  "create_variable",
  "bind_variable",
  // Phase 4: Workflow
  "flatten_node",
  "ungroup_nodes",
  "set_selection",
  "set_current_page",
  "create_effect_style",
  "get_variables",
  // Phase 5: Design system
  "combine_as_variants",
  "detach_instance",
  "swap_component",
  "import_component_by_key",
  // Phase 6: Manipulation
  "set_rotation",
  "set_blend_mode",
  "lock_node",
  // Phase 6: Extra shapes
  "create_star",
  "create_svg_node",
  "notify",
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

// For image data — no length cap (images can be hundreds of KB as base64)
function assertBase64(val, name) {
  if (typeof val !== "string" || val.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
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
      (f.type === "GRADIENT_LINEAR" ||
        f.type === "GRADIENT_RADIAL" ||
        f.type === "GRADIENT_ANGULAR" ||
        f.type === "GRADIENT_DIAMOND") &&
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
  if ("effects" in node && Array.isArray(node.effects))
    base.effects = node.effects;

  if (node.type === "TEXT") {
    base.characters = node.characters;
    base.fontSize = node.fontSize === figma.mixed ? "MIXED" : node.fontSize;
    base.fontName = node.fontName === figma.mixed ? "MIXED" : node.fontName;
  }
  if ("layoutMode" in node) base.layoutMode = node.layoutMode;
  if ("children" in node) base.childCount = node.children.length;

  return base;
}

// ─── Phase 0/Original: Command Handlers ──────────────────────────────────────

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
    "primaryAxisAlign"
  );
  node.counterAxisAlignItems = assertString(
    nvl(args.counterAxisAlign, "MIN"),
    "counterAxisAlign"
  );

  const padding = args.padding;
  if (padding) {
    node.paddingTop = assertNumber(
      nvl(padding.top, 0),
      "padding.top",
      0,
      10000
    );
    node.paddingRight = assertNumber(
      nvl(padding.right, 0),
      "padding.right",
      0,
      10000
    );
    node.paddingBottom = assertNumber(
      nvl(padding.bottom, 0),
      "padding.bottom",
      0,
      10000
    );
    node.paddingLeft = assertNumber(
      nvl(padding.left, 0),
      "padding.left",
      0,
      10000
    );
  }

  if (args.layoutWrap !== undefined) {
    node.layoutWrap = assertString(
      nvl(args.layoutWrap, "NO_WRAP"),
      "layoutWrap"
    );
  }
  if (args.counterAxisSpacing !== undefined) {
    node.counterAxisSpacing = assertNumber(
      args.counterAxisSpacing,
      "counterAxisSpacing",
      0,
      10000
    );
  }
  if (args.strokesIncludedInLayout !== undefined) {
    node.strokesIncludedInLayout = !!args.strokesIncludedInLayout;
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
    10000
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
      100
    );
    const strokeAlign = assertString(
      nvl(stroke.align, "INSIDE"),
      "stroke.align"
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
    "typography.fontFamily"
  );
  const fontStyle = assertString(
    nvl(typo.fontStyle, "Regular"),
    "typography.fontStyle"
  );
  const fontSize = assertNumber(
    nvl(typo.fontSize, 16),
    "typography.fontSize",
    1,
    1000
  );
  const textAlign = assertString(
    nvl(typo.textAlign, "LEFT"),
    "typography.textAlign"
  );
  const letterSpacing = assertNumber(
    nvl(typo.letterSpacing, 0),
    "typography.letterSpacing",
    -100,
    1000
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
        "fontFamily"
      );
      const style = assertString(
        nvl(typo.fontStyle, fontName.style),
        "fontStyle"
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
    10000
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
    "color"
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

  if (!["FRAME", "GROUP", "RECTANGLE", "ELLIPSE", "TEXT", "LINE", "POLYGON", "STAR", "VECTOR"].includes(node.type)) {
    throw new Error(`Cannot convert ${node.type} to component`);
  }

  var component = node.type === "COMPONENT" ? node : figma.createComponentFromNode(node);

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

// ─── Phase 1: Node Operations ─────────────────────────────────────────────────

async function handleCloneNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  const clone = node.clone();

  if (args.x !== undefined)
    clone.x = assertNumber(args.x, "x", -100000, 100000);
  if (args.y !== undefined)
    clone.y = assertNumber(args.y, "y", -100000, 100000);

  if (args.parentId) {
    const parent = resolveParent(assertString(args.parentId, "parentId"));
    if (parent !== figma.currentPage) parent.appendChild(clone);
  }

  return { nodeId: clone.id, name: clone.name, type: clone.type };
}

async function handleReorderNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const index = assertNumber(args.index, "index", 0, 10000);
  const node = findNode(nodeId);
  const parent = node.parent;
  if (!parent) throw new Error(`Node ${nodeId} has no parent`);
  if (!("insertChild" in parent))
    throw new Error(`Parent does not support reordering`);
  parent.insertChild(index, node);
  return { nodeId: node.id, newIndex: index };
}

// ─── Phase 1: Component Instances ─────────────────────────────────────────────

async function handleCreateComponentInstance(args) {
  const componentId = assertString(args.componentId, "componentId");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");

  const component = figma.getNodeById(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);
  if (component.type !== "COMPONENT")
    throw new Error(`Node ${componentId} is not a COMPONENT`);

  const instance = component.createInstance();
  instance.x = x;
  instance.y = y;

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(instance);

  return {
    nodeId: instance.id,
    name: instance.name,
    type: "INSTANCE",
    componentId: componentId,
  };
}

async function handleGetLocalComponents(_args) {
  const components = figma.root.findAll(function (n) {
    return n.type === "COMPONENT";
  });
  return {
    count: components.length,
    components: components.map(function (c) {
      return {
        id: c.id,
        name: c.name,
        key: c.key || "",
        description: c.description || "",
      };
    }),
  };
}

async function handleListAvailableFonts(_args) {
  const fonts = await figma.listAvailableFontsAsync();
  return {
    count: fonts.length,
    fonts: fonts.map(function (f) {
      return { family: f.fontName.family, style: f.fontName.style };
    }),
  };
}

// ─── Phase 1: Advanced Styling ────────────────────────────────────────────────

async function handleSetFill(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (!("fills" in node))
    throw new Error(`Node ${nodeId} does not support fills`);
  const fills = assertFills(args.fills, "fills");
  node.fills = fillsToFigma(fills);
  return { nodeId: node.id, fillCount: node.fills.length };
}

async function handleSetStroke(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (!("strokes" in node))
    throw new Error(`Node ${nodeId} does not support strokes`);

  if (args.strokes !== undefined) {
    if (args.strokes.length === 0) {
      node.strokes = [];
    } else {
      node.strokes = args.strokes.map(function (s) {
        const c = assertRGBA(s.color, "stroke.color");
        return {
          type: "SOLID",
          color: { r: c.r, g: c.g, b: c.b },
          opacity: c.a * nvl(s.opacity, 1),
        };
      });
    }
  }

  if (args.strokeWeight !== undefined)
    node.strokeWeight = assertNumber(args.strokeWeight, "strokeWeight", 0, 100);
  if (args.strokeAlign !== undefined)
    node.strokeAlign = assertString(args.strokeAlign, "strokeAlign");
  if (args.dashPattern !== undefined && Array.isArray(args.dashPattern))
    node.dashPattern = args.dashPattern;
  if (args.strokeCap !== undefined)
    node.strokeCap = assertString(args.strokeCap, "strokeCap");
  if (args.strokeJoin !== undefined)
    node.strokeJoin = assertString(args.strokeJoin, "strokeJoin");

  return { nodeId: node.id };
}

async function handleSetCornerRadius(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);

  if (!("cornerRadius" in node))
    throw new Error(`Node ${nodeId} does not support corner radius`);

  if (args.topLeft !== undefined)
    node.topLeftRadius = assertNumber(args.topLeft, "topLeft", 0, 10000);
  if (args.topRight !== undefined)
    node.topRightRadius = assertNumber(args.topRight, "topRight", 0, 10000);
  if (args.bottomRight !== undefined)
    node.bottomRightRadius = assertNumber(
      args.bottomRight,
      "bottomRight",
      0,
      10000
    );
  if (args.bottomLeft !== undefined)
    node.bottomLeftRadius = assertNumber(
      args.bottomLeft,
      "bottomLeft",
      0,
      10000
    );
  if (args.cornerSmoothing !== undefined)
    node.cornerSmoothing = assertNumber(
      args.cornerSmoothing,
      "cornerSmoothing",
      0,
      1
    );

  return { nodeId: node.id };
}

async function handleSetEffects(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (!("effects" in node))
    throw new Error(`Node ${nodeId} does not support effects`);

  if (!Array.isArray(args.effects)) throw new Error("effects must be an array");

  node.effects = args.effects.map(function (e, i) {
    const t = e.type;
    if (t === "DROP_SHADOW" || t === "INNER_SHADOW") {
      const c = assertRGBA(
        nvl(e.color, { r: 0, g: 0, b: 0, a: 0.25 }),
        "effects[" + i + "].color"
      );
      return {
        type: t,
        color: { r: c.r, g: c.g, b: c.b, a: c.a },
        offset: { x: nvl(e.offsetX, 0), y: nvl(e.offsetY, 4) },
        radius: nvl(e.blur, 8),
        spread: nvl(e.spread, 0),
        visible: nvl(e.visible, true),
        blendMode: nvl(e.blendMode, "NORMAL"),
      };
    }
    if (t === "LAYER_BLUR" || t === "BACKGROUND_BLUR") {
      return {
        type: t,
        radius: nvl(e.radius, t === "BACKGROUND_BLUR" ? 8 : 4),
        visible: nvl(e.visible, true),
      };
    }
    throw new Error("Unsupported effect type: " + t);
  });

  return { nodeId: node.id, effectCount: node.effects.length };
}

// ─── Phase 1: Advanced Auto-Layout ───────────────────────────────────────────

async function handleSetNodeLayoutProperties(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);

  if (args.layoutAlign !== undefined)
    node.layoutAlign = assertString(args.layoutAlign, "layoutAlign");
  if (args.layoutGrow !== undefined)
    node.layoutGrow = assertNumber(args.layoutGrow, "layoutGrow", 0, 1);
  if (args.layoutPositioning !== undefined)
    node.layoutPositioning = assertString(
      args.layoutPositioning,
      "layoutPositioning"
    );
  if (args.layoutSizingHorizontal !== undefined)
    node.layoutSizingHorizontal = assertString(
      args.layoutSizingHorizontal,
      "layoutSizingHorizontal"
    );
  if (args.layoutSizingVertical !== undefined)
    node.layoutSizingVertical = assertString(
      args.layoutSizingVertical,
      "layoutSizingVertical"
    );
  if (args.minWidth !== undefined)
    node.minWidth = assertNumber(args.minWidth, "minWidth", 0, 100000);
  if (args.maxWidth !== undefined)
    node.maxWidth = assertNumber(args.maxWidth, "maxWidth", 0, 100000);
  if (args.minHeight !== undefined)
    node.minHeight = assertNumber(args.minHeight, "minHeight", 0, 100000);
  if (args.maxHeight !== undefined)
    node.maxHeight = assertNumber(args.maxHeight, "maxHeight", 0, 100000);

  return { nodeId: node.id };
}

// ─── Phase 1: Additional Shapes ───────────────────────────────────────────────

async function handleCreateLine(args) {
  const name = assertString(nvl(args.name, "Line"), "name");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const length = assertNumber(nvl(args.length, 100), "length", 1, 100000);
  const rotation = assertNumber(nvl(args.rotation, 0), "rotation", -360, 360);
  const strokeWeight = assertNumber(
    nvl(args.strokeWeight, 1),
    "strokeWeight",
    0.01,
    100
  );
  const parentId = assertOptionalString(args.parentId, "parentId");

  const strokeColor = assertRGBA(
    nvl(args.strokeColor, { r: 0, g: 0, b: 0, a: 1 }),
    "strokeColor"
  );

  const line = figma.createLine();
  line.name = name;
  line.x = x;
  line.y = y;
  line.resize(length, 0);
  line.rotation = rotation;
  line.strokes = [
    {
      type: "SOLID",
      color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b },
      opacity: strokeColor.a,
    },
  ];
  line.strokeWeight = strokeWeight;

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(line);

  return { nodeId: line.id, name: line.name, type: "LINE" };
}

async function handleCreatePolygon(args) {
  const name = assertString(nvl(args.name, "Polygon"), "name");
  const pointCount = assertNumber(nvl(args.pointCount, 3), "pointCount", 3, 20);
  const width = assertNumber(nvl(args.width, 100), "width", 1, 100000);
  const height = assertNumber(nvl(args.height, 100), "height", 1, 100000);
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  const poly = figma.createPolygon();
  poly.name = name;
  poly.pointCount = pointCount;
  poly.resize(width, height);
  poly.x = x;
  poly.y = y;

  if (fills) poly.fills = fillsToFigma(fills);

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(poly);

  return { nodeId: poly.id, name: poly.name, type: "POLYGON" };
}

// ─── Phase 2: Style System ────────────────────────────────────────────────────

async function handleCreatePaintStyle(args) {
  const name = assertString(args.name, "name");
  const fills = assertFills(args.paints, "paints");
  const style = figma.createPaintStyle();
  style.name = name;
  style.paints = fillsToFigma(fills);
  return { styleId: style.id, name: style.name, type: "PAINT" };
}

async function handleCreateTextStyle(args) {
  const name = assertString(args.name, "name");
  const typo = args.typography || {};
  const fontFamily = assertString(
    nvl(typo.fontFamily, "Inter"),
    "typography.fontFamily"
  );
  const fontStyle = assertString(
    nvl(typo.fontStyle, "Regular"),
    "typography.fontStyle"
  );
  const fontSize = assertNumber(
    nvl(typo.fontSize, 16),
    "typography.fontSize",
    1,
    1000
  );

  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  const style = figma.createTextStyle();
  style.name = name;
  style.fontName = { family: fontFamily, style: fontStyle };
  style.fontSize = fontSize;

  if (typo.textAlign)
    style.textAlignHorizontal = assertString(typo.textAlign, "textAlign");
  if (typo.letterSpacing !== undefined)
    style.letterSpacing = {
      value: assertNumber(typo.letterSpacing, "letterSpacing", -100, 1000),
      unit: "PIXELS",
    };
  if (typo.lineHeight) {
    const unit = assertString(
      nvl(typo.lineHeight.unit, "AUTO"),
      "lineHeight.unit"
    );
    if (unit === "AUTO") {
      style.lineHeight = { unit: "AUTO" };
    } else if (unit === "PIXELS" || unit === "PERCENT") {
      style.lineHeight = {
        value: assertNumber(typo.lineHeight.value, "lineHeight.value", 0),
        unit: unit,
      };
    }
  }

  return { styleId: style.id, name: style.name, type: "TEXT" };
}

async function handleGetLocalStyles(_args) {
  const paintStyles = figma.getLocalPaintStyles().map(function (s) {
    return { id: s.id, name: s.name, type: "PAINT" };
  });
  const textStyles = figma.getLocalTextStyles().map(function (s) {
    return { id: s.id, name: s.name, type: "TEXT" };
  });
  const effectStyles = figma.getLocalEffectStyles().map(function (s) {
    return { id: s.id, name: s.name, type: "EFFECT" };
  });
  return {
    paintStyles: paintStyles,
    textStyles: textStyles,
    effectStyles: effectStyles,
    totalCount: paintStyles.length + textStyles.length + effectStyles.length,
  };
}

async function handleApplyStyle(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  const applied = [];

  if (args.fillStyleId !== undefined) {
    node.fillStyleId = assertString(args.fillStyleId, "fillStyleId");
    applied.push("fillStyleId");
  }
  if (args.strokeStyleId !== undefined) {
    node.strokeStyleId = assertString(args.strokeStyleId, "strokeStyleId");
    applied.push("strokeStyleId");
  }
  if (args.textStyleId !== undefined) {
    if (node.type !== "TEXT")
      throw new Error("textStyleId can only be applied to TEXT nodes");
    node.textStyleId = assertString(args.textStyleId, "textStyleId");
    applied.push("textStyleId");
  }
  if (args.effectStyleId !== undefined) {
    node.effectStyleId = assertString(args.effectStyleId, "effectStyleId");
    applied.push("effectStyleId");
  }

  return { nodeId: node.id, applied: applied };
}

// ─── Phase 2: Images ─────────────────────────────────────────────────────────

// Pure-JS base64 decoder — works in Figma's QuickJS sandbox where atob is unavailable
function base64Decode(b64) {
  if (typeof atob === "function") {
    var raw = atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var lookup = {};
  for (var c = 0; c < B64.length; c++) lookup[B64[c]] = c;
  var clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  var len = clean.length;
  var padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  var byteLen = (len * 3) / 4 - padding;
  var bytes = new Uint8Array(byteLen);
  var p = 0;
  for (var j = 0; j < len; j += 4) {
    var a0 = lookup[clean[j]] || 0;
    var a1 = lookup[clean[j + 1]] || 0;
    var a2 = lookup[clean[j + 2]] || 0;
    var a3 = lookup[clean[j + 3]] || 0;
    bytes[p++] = (a0 << 2) | (a1 >> 4);
    if (p < byteLen) bytes[p++] = ((a1 & 15) << 4) | (a2 >> 2);
    if (p < byteLen) bytes[p++] = ((a2 & 3) << 6) | a3;
  }
  return bytes;
}

async function handleSetImageFill(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const imageData = assertBase64(args.imageData, "imageData");
  const scaleMode = assertString(nvl(args.scaleMode, "FILL"), "scaleMode");
  const node = findNode(nodeId);
  if (!("fills" in node))
    throw new Error(`Node ${nodeId} does not support fills`);

  const bytes = base64Decode(imageData);
  const image = figma.createImage(bytes);
  node.fills = [{ type: "IMAGE", scaleMode: scaleMode, imageHash: image.hash }];

  return { nodeId: node.id, imageHash: image.hash, scaleMode: scaleMode };
}

// ─── Phase 2: Export ──────────────────────────────────────────────────────────

async function handleExportNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const format = assertString(nvl(args.format, "PNG"), "format");
  const scale = assertNumber(nvl(args.scale, 1), "scale", 0.01, 4);
  const node = findNode(nodeId);

  const exportSettings = { format: format };
  if (format === "PNG" || format === "JPG") {
    exportSettings.constraint = { type: "SCALE", value: scale };
  }

  const bytes = await node.exportAsync(exportSettings);
  let base64Data;
  if (typeof Buffer !== "undefined") {
    base64Data = Buffer.from(bytes).toString("base64");
  } else if (typeof btoa === "function") {
    // btoa is available (standard browser environment)
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64Data = btoa(binary);
  } else {
    // Pure-JS base64 encoder — works in Figma's QuickJS sandbox where btoa is not available
    var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = [];
    var len = bytes.length;
    for (var i = 0; i < len; i += 3) {
      var b0 = bytes[i];
      var b1 = i + 1 < len ? bytes[i + 1] : 0;
      var b2 = i + 2 < len ? bytes[i + 2] : 0;
      out.push(B64_CHARS[b0 >> 2]);
      out.push(B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)]);
      out.push(i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=");
      out.push(i + 2 < len ? B64_CHARS[b2 & 63] : "=");
    }
    base64Data = out.join("");
  }

  return {
    nodeId: node.id,
    format: format,
    scale: scale,
    base64Data: base64Data,
    size: bytes.length,
  };
}

// ─── Phase 2: Typography ──────────────────────────────────────────────────────

async function handleSetTextDecoration(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const textDecoration = assertString(args.textDecoration, "textDecoration");
  const node = findNode(nodeId);
  if (node.type !== "TEXT")
    throw new Error(`Node ${nodeId} is not a TEXT node`);

  const fontName =
    node.fontName === figma.mixed
      ? { family: "Inter", style: "Regular" }
      : node.fontName;
  await figma.loadFontAsync(fontName);
  node.textDecoration = textDecoration;

  return { nodeId: node.id, textDecoration: textDecoration };
}

async function handleSetTextCase(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const textCase = assertString(args.textCase, "textCase");
  const node = findNode(nodeId);
  if (node.type !== "TEXT")
    throw new Error(`Node ${nodeId} is not a TEXT node`);

  const fontName =
    node.fontName === figma.mixed
      ? { family: "Inter", style: "Regular" }
      : node.fontName;
  await figma.loadFontAsync(fontName);
  node.textCase = textCase;

  return { nodeId: node.id, textCase: textCase };
}

async function handleSetTextList(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const listType = assertString(args.listType, "listType");
  const node = findNode(nodeId);
  if (node.type !== "TEXT")
    throw new Error(`Node ${nodeId} is not a TEXT node`);

  const fontName =
    node.fontName === figma.mixed
      ? { family: "Inter", style: "Regular" }
      : node.fontName;
  await figma.loadFontAsync(fontName);
  node.setRangeListOptions(0, node.characters.length, { type: listType });

  return { nodeId: node.id, listType: listType };
}

// ─── Phase 2: Constraints & Grids ────────────────────────────────────────────

async function handleSetConstraints(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const horizontal = assertString(args.horizontal, "horizontal");
  const vertical = assertString(args.vertical, "vertical");
  const node = findNode(nodeId);
  if (!("constraints" in node))
    throw new Error(`Node ${nodeId} does not support constraints`);
  node.constraints = { horizontal: horizontal, vertical: vertical };
  return { nodeId: node.id, constraints: node.constraints };
}

async function handleSetLayoutGrids(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (node.type !== "FRAME" && node.type !== "COMPONENT")
    throw new Error("Layout grids can only be set on frames or components");
  if (!Array.isArray(args.grids)) throw new Error("grids must be an array");

  node.layoutGrids = args.grids.map(function (g, i) {
    return {
      pattern: assertString(g.pattern, "grids[" + i + "].pattern"),
      count: assertNumber(nvl(g.count, 12), "grids[" + i + "].count", 1, 100),
      gutterSize: assertNumber(
        nvl(g.gutterSize, 16),
        "grids[" + i + "].gutterSize",
        0,
        1000
      ),
      offset: assertNumber(
        nvl(g.offset, 0),
        "grids[" + i + "].offset",
        0,
        1000
      ),
      alignment: nvl(g.alignment, "STRETCH"),
      sectionSize:
        g.sectionSize !== undefined
          ? assertNumber(g.sectionSize, "sectionSize", 1, 1000)
          : undefined,
      color: g.color
        ? {
            r: g.color.r,
            g: g.color.g,
            b: g.color.b,
            a: nvl(g.color.a, 0.1),
          }
        : { r: 0.1, g: 0.1, b: 1, a: 0.1 },
      visible: nvl(g.visible, true),
    };
  });

  return { nodeId: node.id, gridCount: node.layoutGrids.length };
}

// ─── Phase 3: Batch Operations ────────────────────────────────────────────────

async function handleBatchCreate(args) {
  if (!Array.isArray(args.operations))
    throw new Error("operations must be an array");
  const results = [];

  for (let i = 0; i < args.operations.length; i++) {
    const op = args.operations[i];
    try {
      const handler = handlers[op.command];
      if (!handler) throw new Error("Unknown command: " + op.command);
      const result = await handler(op.args || {});
      results.push({ index: i, success: true, data: result });
    } catch (err) {
      results.push({
        index: i,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    results: results,
    successCount: results.filter(function (r) {
      return r.success;
    }).length,
  };
}

async function handleBatchUpdate(args) {
  if (!Array.isArray(args.updates)) throw new Error("updates must be an array");
  const results = [];

  for (let i = 0; i < args.updates.length; i++) {
    const update = args.updates[i];
    try {
      const result = await handleUpdateNode(update);
      results.push({
        index: i,
        nodeId: update.nodeId,
        success: true,
        data: result,
      });
    } catch (err) {
      results.push({
        index: i,
        nodeId: update.nodeId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    results: results,
    successCount: results.filter(function (r) {
      return r.success;
    }).length,
  };
}

// ─── Phase 3: Vector ─────────────────────────────────────────────────────────

async function handleCreateVector(args) {
  const name = assertString(nvl(args.name, "Vector"), "name");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");

  if (!Array.isArray(args.vectorPaths) || args.vectorPaths.length === 0)
    throw new Error("vectorPaths must be a non-empty array");

  const vector = figma.createVector();
  vector.name = name;
  vector.x = x;
  vector.y = y;
  vector.vectorPaths = args.vectorPaths.map(function (p, i) {
    return {
      windingRule: nvl(p.windingRule, "EVENODD"),
      data: assertString(p.data, "vectorPaths[" + i + "].data"),
    };
  });

  if (args.fills) {
    const fills = assertFills(args.fills, "fills");
    vector.fills = fillsToFigma(fills);
  }

  const parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(vector);

  return { nodeId: vector.id, name: vector.name, type: "VECTOR" };
}

async function handleCreateBooleanOperation(args) {
  if (!Array.isArray(args.nodeIds) || args.nodeIds.length < 2)
    throw new Error("nodeIds must have at least 2 elements");

  const operation = assertString(args.operation, "operation");
  const nodes = args.nodeIds.map(function (id) {
    return findNode(assertString(id, "nodeId"));
  });
  const parent = nvl(nodes[0].parent, figma.currentPage);

  var result;
  if (operation === "UNION") result = figma.union(nodes, parent);
  else if (operation === "INTERSECT") result = figma.intersect(nodes, parent);
  else if (operation === "SUBTRACT") result = figma.subtract(nodes, parent);
  else if (operation === "EXCLUDE") result = figma.exclude(nodes, parent);
  else throw new Error("Unknown operation: " + operation);

  if (args.name) result.name = assertString(args.name, "name");

  return { nodeId: result.id, name: result.name, type: result.type };
}

// ─── Phase 3: Pages & Sections ───────────────────────────────────────────────

async function handleCreatePage(args) {
  const name = assertString(nvl(args.name, "Page"), "name");
  const page = figma.createPage();
  page.name = name;
  return { pageId: page.id, name: page.name };
}

async function handleCreateSection(args) {
  const name = assertString(nvl(args.name, "Section"), "name");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const width = assertNumber(nvl(args.width, 800), "width", 1, 100000);
  const height = assertNumber(nvl(args.height, 600), "height", 1, 100000);

  const section = figma.createSection();
  section.name = name;
  section.x = x;
  section.y = y;
  section.resizeWithoutConstraints(width, height);

  if (args.fillColor) {
    const c = assertRGBA(args.fillColor, "fillColor");
    section.fills = [
      {
        type: "SOLID",
        color: { r: c.r, g: c.g, b: c.b },
        opacity: c.a,
      },
    ];
  }

  return { sectionId: section.id, name: section.name, type: "SECTION" };
}

// ─── Phase 3: Node Traversal ──────────────────────────────────────────────────

async function handleFindNodes(args) {
  const types = args.types || null;
  const namePattern = assertOptionalString(args.namePattern, "namePattern");
  const maxResults = assertNumber(
    nvl(args.maxResults, 50),
    "maxResults",
    1,
    200
  );

  var root;
  if (args.parentId) {
    root = findNode(assertString(args.parentId, "parentId"));
  } else {
    root = figma.currentPage;
  }

  if (!("findAll" in root))
    throw new Error("Root node does not support findAll");

  const found = root.findAll(function (node) {
    const typeMatch = !types || types.includes(node.type);
    const nameMatch = !namePattern || node.name.indexOf(namePattern) !== -1;
    return typeMatch && nameMatch;
  });

  const limited = found.slice(0, maxResults);
  return {
    count: found.length,
    nodes: limited.map(function (n) {
      return { id: n.id, name: n.name, type: n.type };
    }),
  };
}

// ─── Phase 3: Variables ───────────────────────────────────────────────────────

async function handleCreateVariableCollection(args) {
  const name = assertString(args.name, "name");
  const modes =
    Array.isArray(args.modes) && args.modes.length > 0
      ? args.modes
      : ["Default"];

  const collection = figma.variables.createVariableCollection(name);
  // Rename the auto-created first mode
  if (collection.modes.length > 0) {
    collection.renameMode(collection.modes[0].modeId, modes[0]);
  }
  // Add additional modes
  for (let i = 1; i < modes.length; i++) {
    collection.addMode(assertString(modes[i], "modes[" + i + "]"));
  }

  return {
    collectionId: collection.id,
    name: collection.name,
    modes: collection.modes,
  };
}

async function handleCreateVariable(args) {
  const name = assertString(args.name, "name");
  const collectionId = assertString(args.collectionId, "collectionId");
  const type = assertString(args.type, "type");

  const collection = figma.variables.getVariableCollectionById(collectionId);
  if (!collection)
    throw new Error(`Variable collection ${collectionId} not found`);

  const variable = figma.variables.createVariable(name, collection, type);

  if (args.values && typeof args.values === "object") {
    const entries = Object.entries(args.values);
    for (let i = 0; i < entries.length; i++) {
      variable.setValueForMode(entries[i][0], entries[i][1]);
    }
  }

  return {
    variableId: variable.id,
    name: variable.name,
    type: variable.resolvedType,
  };
}

async function handleBindVariable(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const property = assertString(args.property, "property");
  const variableId = assertString(args.variableId, "variableId");

  const node = findNode(nodeId);
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) throw new Error(`Variable ${variableId} not found`);

  node.setBoundVariable(property, variable);

  return { nodeId: node.id, property: property, variableId: variableId };
}

// ─── Phase 4: Workflow Tools ──────────────────────────────────────────────────

async function handleFlattenNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  var flat = figma.flatten([node]);
  return { nodeId: flat.id, name: flat.name, type: flat.type };
}

async function handleUngroupNodes(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (node.type !== "GROUP") throw new Error("Node " + nodeId + " is not a GROUP");
  var parent = node.parent || figma.currentPage;
  if (!("insertChild" in parent)) throw new Error("Parent does not support children");
  var children = node.children.slice();
  var idx = parent.children.indexOf(node);
  var movedIds = [];
  for (var i = 0; i < children.length; i++) {
    parent.insertChild(idx + i, children[i]);
    movedIds.push(children[i].id);
  }
  node.remove();
  return { movedNodeIds: movedIds, count: movedIds.length };
}

async function handleSetSelection(args) {
  if (!Array.isArray(args.nodeIds)) throw new Error("nodeIds must be an array");
  var nodes = args.nodeIds.map(function (id) { return findNode(assertString(id, "nodeId")); });
  figma.currentPage.selection = nodes;
  return { selectedCount: nodes.length };
}

async function handleSetCurrentPage(args) {
  const pageId = assertString(args.pageId, "pageId");
  const page = figma.getNodeById(pageId);
  if (!page || page.type !== "PAGE") throw new Error("Page " + pageId + " not found");
  await figma.setCurrentPageAsync(page);
  return { pageId: page.id, pageName: page.name };
}

async function handleCreateEffectStyle(args) {
  const name = assertString(args.name, "name");
  if (!Array.isArray(args.effects)) throw new Error("effects must be an array");
  var style = figma.createEffectStyle();
  style.name = name;
  style.effects = args.effects.map(function (e, i) {
    var t = e.type;
    if (t === "DROP_SHADOW" || t === "INNER_SHADOW") {
      var c = assertRGBA(nvl(e.color, { r: 0, g: 0, b: 0, a: 0.25 }), "effects[" + i + "].color");
      return {
        type: t,
        color: { r: c.r, g: c.g, b: c.b, a: c.a },
        offset: { x: nvl(e.offsetX, 0), y: nvl(e.offsetY, 4) },
        radius: nvl(e.blur, 8),
        spread: nvl(e.spread, 0),
        visible: nvl(e.visible, true),
        blendMode: nvl(e.blendMode, "NORMAL"),
      };
    }
    if (t === "LAYER_BLUR" || t === "BACKGROUND_BLUR") {
      return { type: t, radius: nvl(e.radius, t === "BACKGROUND_BLUR" ? 8 : 4), visible: nvl(e.visible, true) };
    }
    throw new Error("Unsupported effect type: " + t);
  });
  return { styleId: style.id, name: style.name, type: "EFFECT" };
}

async function handleGetVariables(_args) {
  var collections = figma.variables.getLocalVariableCollections();
  var variables = figma.variables.getLocalVariables();
  return {
    collections: collections.map(function (c) {
      return { id: c.id, name: c.name, modes: c.modes };
    }),
    variables: variables.map(function (v) {
      return {
        id: v.id,
        name: v.name,
        resolvedType: v.resolvedType,
        collectionId: v.variableCollectionId,
      };
    }),
    collectionCount: collections.length,
    variableCount: variables.length,
  };
}

// ─── Phase 5: Design System Tools ────────────────────────────────────────────

async function handleCombineAsVariants(args) {
  if (!Array.isArray(args.nodeIds) || args.nodeIds.length < 2)
    throw new Error("nodeIds must have at least 2 elements");
  var nodes = args.nodeIds.map(function (id) { return findNode(assertString(id, "nodeId")); });
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type !== "COMPONENT")
      throw new Error("Node " + nodes[i].id + " is not a COMPONENT");
  }
  var parent = nvl(nodes[0].parent, figma.currentPage);
  var componentSet = figma.combineAsVariants(nodes, parent);
  if (args.name) componentSet.name = assertString(args.name, "name");
  return { nodeId: componentSet.id, name: componentSet.name, type: "COMPONENT_SET", variantCount: componentSet.children.length };
}

async function handleDetachInstance(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (node.type !== "INSTANCE") throw new Error("Node " + nodeId + " is not an INSTANCE");
  var frame = node.detachInstance();
  return { nodeId: frame.id, name: frame.name, type: frame.type };
}

async function handleSwapComponent(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const newComponentId = assertString(args.newComponentId, "newComponentId");
  const node = findNode(nodeId);
  if (node.type !== "INSTANCE") throw new Error("Node " + nodeId + " is not an INSTANCE");
  var newComponent = figma.getNodeById(newComponentId);
  if (!newComponent || newComponent.type !== "COMPONENT")
    throw new Error("Component " + newComponentId + " not found");
  node.swapComponent(newComponent);
  return { nodeId: node.id, name: node.name, newComponentId: newComponentId };
}

async function handleImportComponentByKey(args) {
  const key = assertString(args.key, "key");
  var component = await figma.importComponentByKeyAsync(key);
  return { componentId: component.id, name: component.name, key: component.key };
}

// ─── Phase 6: Manipulation Tools ─────────────────────────────────────────────

async function handleSetRotation(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const rotation = assertNumber(args.rotation, "rotation", -360, 360);
  const node = findNode(nodeId);
  node.rotation = rotation;
  return { nodeId: node.id, rotation: node.rotation };
}

async function handleSetBlendMode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const blendMode = assertString(args.blendMode, "blendMode");
  const node = findNode(nodeId);
  if (!("blendMode" in node)) throw new Error("Node " + nodeId + " does not support blendMode");
  node.blendMode = blendMode;
  return { nodeId: node.id, blendMode: node.blendMode };
}

async function handleLockNode(args) {
  const nodeId = assertString(args.nodeId, "nodeId");
  const node = findNode(nodeId);
  if (typeof args.locked !== "boolean") throw new Error("locked must be a boolean");
  node.locked = args.locked;
  return { nodeId: node.id, locked: node.locked };
}

// ─── Phase 6: Extra Shape Tools ──────────────────────────────────────────────

async function handleCreateStar(args) {
  const name = assertString(nvl(args.name, "Star"), "name");
  const pointCount = assertNumber(nvl(args.pointCount, 5), "pointCount", 3, 20);
  const innerRadius = assertNumber(nvl(args.innerRadius, 0.382), "innerRadius", 0.01, 0.99);
  const width = assertNumber(nvl(args.width, 100), "width", 1, 100000);
  const height = assertNumber(nvl(args.height, 100), "height", 1, 100000);
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");
  const fills = args.fills ? assertFills(args.fills, "fills") : undefined;

  var star = figma.createStar();
  star.name = name;
  star.pointCount = pointCount;
  star.innerRadius = innerRadius;
  star.resize(width, height);
  star.x = x;
  star.y = y;
  if (fills) star.fills = fillsToFigma(fills);

  var parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(star);

  return { nodeId: star.id, name: star.name, type: "STAR" };
}

async function handleCreateSvgNode(args) {
  const svg = assertString(args.svg, "svg");
  const x = assertNumber(nvl(args.x, 0), "x", -100000, 100000);
  const y = assertNumber(nvl(args.y, 0), "y", -100000, 100000);
  const parentId = assertOptionalString(args.parentId, "parentId");

  var node = figma.createNodeFromSvg(svg);
  node.x = x;
  node.y = y;
  if (args.name) node.name = assertString(args.name, "name");

  var parent = resolveParent(parentId);
  if (parent !== figma.currentPage) parent.appendChild(node);

  return { nodeId: node.id, name: node.name, type: node.type };
}

async function handleNotify(args) {
  const message = assertString(args.message, "message");
  const isError = !!args.error;
  const timeout = assertNumber(nvl(args.timeout, 4000), "timeout", 1000, 30000);
  figma.notify(message, { error: isError, timeout: timeout });
  return { message: message, error: isError, timeout: timeout };
}

// ─── Handler Registry ────────────────────────────────────────────────────────

const handlers = {
  // Read
  get_document_info: handleGetDocumentInfo,
  get_selection: handleGetSelection,
  get_node: handleGetNode,
  // Create
  create_frame: handleCreateFrame,
  create_rectangle: handleCreateRectangle,
  create_ellipse: handleCreateEllipse,
  create_text: handleCreateText,
  create_line: handleCreateLine,
  create_polygon: handleCreatePolygon,
  // Modify
  set_auto_layout: handleSetAutoLayout,
  update_text: handleUpdateText,
  update_node: handleUpdateNode,
  add_shadow: handleAddShadow,
  // Style
  set_fill: handleSetFill,
  set_stroke: handleSetStroke,
  set_corner_radius: handleSetCornerRadius,
  set_effects: handleSetEffects,
  // Layout
  set_node_layout_properties: handleSetNodeLayoutProperties,
  // Organize
  group_nodes: handleGroupNodes,
  delete_node: handleDeleteNode,
  create_component: handleCreateComponent,
  clone_node: handleCloneNode,
  reorder_node: handleReorderNode,
  // Component
  create_component_instance: handleCreateComponentInstance,
  get_local_components: handleGetLocalComponents,
  list_available_fonts: handleListAvailableFonts,
  // Viewport
  zoom_to_node: handleZoomToNode,
  // Phase 2: Style system
  create_paint_style: handleCreatePaintStyle,
  create_text_style: handleCreateTextStyle,
  get_local_styles: handleGetLocalStyles,
  apply_style: handleApplyStyle,
  // Phase 2: Image
  set_image_fill: handleSetImageFill,
  // Phase 2: Export
  export_node: handleExportNode,
  // Phase 2: Typography
  set_text_decoration: handleSetTextDecoration,
  set_text_case: handleSetTextCase,
  set_text_list: handleSetTextList,
  // Phase 2: Constraints & grids
  set_constraints: handleSetConstraints,
  set_layout_grids: handleSetLayoutGrids,
  // Phase 3: Batch
  batch_create: handleBatchCreate,
  batch_update: handleBatchUpdate,
  // Phase 3: Vector
  create_vector: handleCreateVector,
  create_boolean_operation: handleCreateBooleanOperation,
  // Phase 3: Pages
  create_page: handleCreatePage,
  create_section: handleCreateSection,
  // Phase 3: Traversal
  find_nodes: handleFindNodes,
  // Phase 3: Variables
  create_variable_collection: handleCreateVariableCollection,
  create_variable: handleCreateVariable,
  bind_variable: handleBindVariable,
  // Phase 4: Workflow
  flatten_node: handleFlattenNode,
  ungroup_nodes: handleUngroupNodes,
  set_selection: handleSetSelection,
  set_current_page: handleSetCurrentPage,
  create_effect_style: handleCreateEffectStyle,
  get_variables: handleGetVariables,
  // Phase 5: Design system
  combine_as_variants: handleCombineAsVariants,
  detach_instance: handleDetachInstance,
  swap_component: handleSwapComponent,
  import_component_by_key: handleImportComponentByKey,
  // Phase 6: Manipulation
  set_rotation: handleSetRotation,
  set_blend_mode: handleSetBlendMode,
  lock_node: handleLockNode,
  // Phase 6: Extra shapes
  create_star: handleCreateStar,
  create_svg_node: handleCreateSvgNode,
  notify: handleNotify,
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
        }
  );
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const DEFAULT_BRIDGE_URL = "ws://localhost:9001";

figma.showUI(__html__, { visible: true, width: 300, height: 240 });
pluginLog("info", "Figma MCP Bridge plugin loaded and ready");

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
    pluginLog("error", "Invalid requestId", { requestId: requestId });
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
    var cmdStart = Date.now();
    const data = await handlers[command](args);
    var cmdDuration = Date.now() - cmdStart;
    pluginLog("info", "command completed", {
      command: command, requestId: requestId, durationMs: cmdDuration
    });
    sendResponse(requestId, true, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pluginLog("error", "command failed", {
      command: command, requestId: requestId, error: message
    });
    const code =
      message.indexOf("not found") !== -1
        ? "NODE_NOT_FOUND"
        : message.indexOf("font") !== -1
        ? "FONT_UNAVAILABLE"
        : "EXECUTION_ERROR";
    sendResponse(requestId, false, undefined, { code: code, message: message });
  }
};
