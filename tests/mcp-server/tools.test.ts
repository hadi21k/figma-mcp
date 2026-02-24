import { describe, it, expect } from "vitest";
import {
  TOOL_REGISTRY,
  // Read tools
  GetDocumentInfoInput,
  GetSelectionInput,
  GetNodeInput,
  // Create tools
  CreateFrameInput,
  CreateRectangleInput,
  CreateEllipseInput,
  CreateTextInput,
  CreateLineInput,
  CreatePolygonInput,
  // Modify tools
  SetAutoLayoutInput,
  UpdateTextInput,
  UpdateNodeInput,
  AddShadowInput,
  // Style tools
  SetFillInput,
  SetStrokeInput,
  SetCornerRadiusInput,
  SetEffectsInput,
  // Layout tools
  SetNodeLayoutPropertiesInput,
  // Organize tools
  GroupNodesInput,
  DeleteNodeInput,
  CreateComponentInput,
  CloneNodeInput,
  ReorderNodeInput,
  // Component tools
  CreateComponentInstanceInput,
  GetLocalComponentsInput,
  ListAvailableFontsInput,
  // Viewport tools
  ZoomToNodeInput,
  // Style system tools
  CreatePaintStyleInput,
  CreateTextStyleInput,
  GetLocalStylesInput,
  ApplyStyleInput,
  // Image tools
  SetImageFillInput,
  SetImageFromUrlInput,
  SetImageFromPathInput,
  // Export tools
  ExportNodeInput,
  // Typography tools
  SetTextDecorationInput,
  SetTextCaseInput,
  SetTextListInput,
  // Constraint tools
  SetConstraintsInput,
  SetLayoutGridsInput,
  // Batch tools
  BatchCreateInput,
  BatchUpdateInput,
  // Vector tools
  CreateVectorInput,
  CreateBooleanOperationInput,
  // Page tools
  CreatePageInput,
  CreateSectionInput,
  // Traversal tools
  FindNodesInput,
  // Variable tools
  CreateVariableCollectionInput,
  CreateVariableInput,
  BindVariableInput,
  // Workflow tools (Phase 4)
  FlattenNodeInput,
  UngroupNodesInput,
  SetSelectionInput,
  SetCurrentPageInput,
  CreateEffectStyleInput,
  GetVariablesInput,
  // Design system tools (Phase 5)
  CombineAsVariantsInput,
  DetachInstanceInput,
  SwapComponentInput,
  ImportComponentByKeyInput,
  // Manipulation tools (Phase 6)
  SetRotationInput,
  SetBlendModeInput,
  LockNodeInput,
  // Extra shape tools (Phase 6)
  CreateStarInput,
  CreateSvgNodeInput,
  NotifyInput,
  // Shared schemas
  RGBAColor,
  NodeId,
  Effect,
  DropShadowEffect,
  InnerShadowEffect,
  LayerBlurEffect,
  BackgroundBlurEffect,
} from "../../src/mcp-server/tools/index.js";

// ─── Tool Registry Tests ─────────────────────────────────────────────────────

describe("Tool Registry", () => {
  it("contains all 66 tools", () => {
    const tools = Object.keys(TOOL_REGISTRY);
    expect(tools).toHaveLength(66);
  });

  const expectedTools = [
    // Read
    "get_document_info", "get_selection", "get_node",
    // Create
    "create_frame", "create_rectangle", "create_ellipse", "create_text",
    "create_line", "create_polygon",
    // Modify
    "set_auto_layout", "update_text", "update_node", "add_shadow",
    // Style
    "set_fill", "set_stroke", "set_corner_radius", "set_effects",
    // Layout
    "set_node_layout_properties",
    // Organize
    "group_nodes", "delete_node", "create_component", "clone_node", "reorder_node",
    // Component
    "create_component_instance", "get_local_components", "list_available_fonts",
    // Viewport
    "zoom_to_node",
    // Phase 2: Style system
    "create_paint_style", "create_text_style", "get_local_styles", "apply_style",
    // Phase 2: Image
    "set_image_fill", "set_image_from_url", "set_image_from_path",
    // Phase 2: Export
    "export_node",
    // Phase 2: Typography
    "set_text_decoration", "set_text_case", "set_text_list",
    // Phase 2: Constraints & grids
    "set_constraints", "set_layout_grids",
    // Phase 3: Batch
    "batch_create", "batch_update",
    // Phase 3: Vector
    "create_vector", "create_boolean_operation",
    // Phase 3: Pages
    "create_page", "create_section",
    // Phase 3: Traversal
    "find_nodes",
    // Phase 3: Variables
    "create_variable_collection", "create_variable", "bind_variable",
    // Phase 4: Workflow
    "flatten_node", "ungroup_nodes", "set_selection", "set_current_page",
    "create_effect_style", "get_variables",
    // Phase 5: Design system
    "combine_as_variants", "detach_instance", "swap_component", "import_component_by_key",
    // Phase 6: Manipulation
    "set_rotation", "set_blend_mode", "lock_node",
    // Phase 6: Extra shapes
    "create_star", "create_svg_node", "notify",
  ];

  it.each(expectedTools)("has tool '%s'", (toolName) => {
    expect(TOOL_REGISTRY[toolName]).toBeDefined();
    expect(TOOL_REGISTRY[toolName].description).toBeTruthy();
    expect(TOOL_REGISTRY[toolName].inputSchema).toBeDefined();
  });

  it("all tools have non-empty descriptions", () => {
    for (const [name, tool] of Object.entries(TOOL_REGISTRY)) {
      expect(tool.description.length, `Tool '${name}' has empty description`).toBeGreaterThan(10);
    }
  });
});

// ─── Shared Type Tests ───────────────────────────────────────────────────────

describe("RGBAColor", () => {
  it("accepts valid RGBA", () => {
    const result = RGBAColor.parse({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 });
    expect(result).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 });
  });

  it("defaults alpha to 1", () => {
    const result = RGBAColor.parse({ r: 0, g: 0, b: 0 });
    expect(result.a).toBe(1);
  });

  it("rejects out-of-range values", () => {
    expect(() => RGBAColor.parse({ r: 1.5, g: 0, b: 0 })).toThrow();
    expect(() => RGBAColor.parse({ r: -1, g: 0, b: 0 })).toThrow();
  });

  it("rejects extra properties (strict)", () => {
    expect(() => RGBAColor.parse({ r: 0, g: 0, b: 0, a: 1, extra: true })).toThrow();
  });
});

describe("NodeId", () => {
  it("accepts valid node IDs", () => {
    expect(NodeId.parse("123:456")).toBe("123:456");
    expect(NodeId.parse("0:1")).toBe("0:1");
  });

  it("rejects empty strings", () => {
    expect(() => NodeId.parse("")).toThrow();
  });

  it("rejects strings over 100 chars", () => {
    expect(() => NodeId.parse("a".repeat(101))).toThrow();
  });
});

// ─── Effect Schemas ───────────────────────────────────────────────────────────

describe("DropShadowEffect", () => {
  it("parses with defaults", () => {
    const result = DropShadowEffect.parse({ type: "DROP_SHADOW" });
    expect(result.type).toBe("DROP_SHADOW");
    expect(result.blur).toBe(8);
    expect(result.offsetY).toBe(4);
    expect(result.visible).toBe(true);
  });

  it("accepts full input", () => {
    const result = DropShadowEffect.parse({
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.15 },
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    });
    expect(result.color.a).toBe(0.15);
  });
});

describe("LayerBlurEffect", () => {
  it("parses with defaults", () => {
    const result = LayerBlurEffect.parse({ type: "LAYER_BLUR" });
    expect(result.radius).toBe(4);
    expect(result.visible).toBe(true);
  });
});

describe("BackgroundBlurEffect", () => {
  it("parses with defaults", () => {
    const result = BackgroundBlurEffect.parse({ type: "BACKGROUND_BLUR" });
    expect(result.radius).toBe(8);
  });
});

describe("Effect (discriminated union)", () => {
  it("parses DROP_SHADOW", () => {
    const e = Effect.parse({ type: "DROP_SHADOW" });
    expect(e.type).toBe("DROP_SHADOW");
  });

  it("parses INNER_SHADOW", () => {
    const e = Effect.parse({ type: "INNER_SHADOW" });
    expect(e.type).toBe("INNER_SHADOW");
  });

  it("parses LAYER_BLUR", () => {
    const e = Effect.parse({ type: "LAYER_BLUR" });
    expect(e.type).toBe("LAYER_BLUR");
  });

  it("parses BACKGROUND_BLUR", () => {
    const e = Effect.parse({ type: "BACKGROUND_BLUR" });
    expect(e.type).toBe("BACKGROUND_BLUR");
  });

  it("rejects unknown effect type", () => {
    expect(() => Effect.parse({ type: "UNKNOWN_EFFECT" })).toThrow();
  });
});

// ─── Read Tool Schema Tests ──────────────────────────────────────────────────

describe("GetDocumentInfoInput", () => {
  it("accepts empty object", () => {
    expect(GetDocumentInfoInput.parse({})).toEqual({});
  });

  it("rejects extra properties", () => {
    expect(() => GetDocumentInfoInput.parse({ extra: true })).toThrow();
  });
});

describe("GetSelectionInput", () => {
  it("accepts empty object", () => {
    expect(GetSelectionInput.parse({})).toEqual({});
  });
});

describe("GetNodeInput", () => {
  it("accepts valid nodeId", () => {
    const result = GetNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });

  it("rejects missing nodeId", () => {
    expect(() => GetNodeInput.parse({})).toThrow();
  });
});

// ─── Frame/Layout Schema Tests ───────────────────────────────────────────────

describe("CreateFrameInput", () => {
  it("accepts valid frame input", () => {
    const result = CreateFrameInput.parse({
      name: "Hero Section",
      width: 1440,
      height: 900,
    });
    expect(result.name).toBe("Hero Section");
    expect(result.width).toBe(1440);
    expect(result.height).toBe(900);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("accepts optional fillColor", () => {
    const result = CreateFrameInput.parse({
      name: "Test",
      width: 100,
      height: 100,
      fillColor: { r: 1, g: 0, b: 0 },
    });
    expect(result.fillColor).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("accepts optional parentId", () => {
    const result = CreateFrameInput.parse({
      name: "Test",
      width: 100,
      height: 100,
      parentId: "123:456",
    });
    expect(result.parentId).toBe("123:456");
  });

  it("rejects missing name", () => {
    expect(() => CreateFrameInput.parse({ width: 100, height: 100 })).toThrow();
  });

  it("rejects zero width", () => {
    expect(() => CreateFrameInput.parse({ name: "Test", width: 0, height: 100 })).toThrow();
  });

  it("rejects negative height", () => {
    expect(() => CreateFrameInput.parse({ name: "Test", width: 100, height: -10 })).toThrow();
  });

  it("rejects extra properties", () => {
    expect(() => CreateFrameInput.parse({
      name: "Test", width: 100, height: 100, unknown: true,
    })).toThrow();
  });
});

describe("SetAutoLayoutInput", () => {
  it("accepts valid auto layout input", () => {
    const result = SetAutoLayoutInput.parse({
      nodeId: "123:456",
      direction: "VERTICAL",
    });
    expect(result.direction).toBe("VERTICAL");
    expect(result.gap).toBe(0);
    expect(result.primaryAxisAlign).toBe("MIN");
    expect(result.counterAxisAlign).toBe("MIN");
    expect(result.layoutWrap).toBe("NO_WRAP");
  });

  it("accepts full input with padding and wrap", () => {
    const result = SetAutoLayoutInput.parse({
      nodeId: "123:456",
      direction: "HORIZONTAL",
      gap: 16,
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      primaryAxisAlign: "SPACE_BETWEEN",
      counterAxisAlign: "CENTER",
      layoutWrap: "WRAP",
      counterAxisSpacing: 8,
      strokesIncludedInLayout: true,
    });
    expect(result.gap).toBe(16);
    expect(result.padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
    expect(result.layoutWrap).toBe("WRAP");
    expect(result.counterAxisSpacing).toBe(8);
    expect(result.strokesIncludedInLayout).toBe(true);
  });

  it("rejects invalid direction", () => {
    expect(() => SetAutoLayoutInput.parse({
      nodeId: "123:456",
      direction: "DIAGONAL",
    })).toThrow();
  });
});

// ─── Shape Schema Tests ──────────────────────────────────────────────────────

describe("CreateRectangleInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreateRectangleInput.parse({ width: 200, height: 100 });
    expect(result.name).toBe("Rectangle");
    expect(result.cornerRadius).toBe(0);
    expect(result.opacity).toBe(1);
    expect(result.fills).toHaveLength(1);
  });

  it("accepts full input", () => {
    const result = CreateRectangleInput.parse({
      name: "Card",
      width: 300,
      height: 200,
      x: 50,
      y: 100,
      cornerRadius: 12,
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
      stroke: { color: { r: 0, g: 0, b: 0 }, weight: 2, align: "OUTSIDE" },
      opacity: 0.8,
      parentId: "123:456",
    });
    expect(result.name).toBe("Card");
    expect(result.cornerRadius).toBe(12);
    expect(result.stroke?.weight).toBe(2);
  });

  it("rejects negative cornerRadius", () => {
    expect(() => CreateRectangleInput.parse({ width: 100, height: 100, cornerRadius: -5 })).toThrow();
  });
});

describe("CreateEllipseInput", () => {
  it("accepts valid input", () => {
    const result = CreateEllipseInput.parse({ width: 100, height: 100 });
    expect(result.name).toBe("Ellipse");
  });

  it("accepts custom fills", () => {
    const result = CreateEllipseInput.parse({
      width: 80,
      height: 80,
      fills: [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 } }],
    });
    expect(result.fills).toHaveLength(1);
  });
});

describe("CreateLineInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreateLineInput.parse({});
    expect(result.name).toBe("Line");
    expect(result.length).toBe(100);
    expect(result.rotation).toBe(0);
    expect(result.strokeWeight).toBe(1);
  });

  it("accepts full input", () => {
    const result = CreateLineInput.parse({
      name: "Divider",
      x: 10,
      y: 20,
      length: 400,
      rotation: 45,
      strokeColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      strokeWeight: 2,
    });
    expect(result.length).toBe(400);
    expect(result.rotation).toBe(45);
  });

  it("rejects negative length", () => {
    expect(() => CreateLineInput.parse({ length: -10 })).toThrow();
  });
});

describe("CreatePolygonInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreatePolygonInput.parse({ width: 100, height: 100 });
    expect(result.name).toBe("Polygon");
    expect(result.pointCount).toBe(3);
  });

  it("accepts hexagon", () => {
    const result = CreatePolygonInput.parse({ width: 80, height: 80, pointCount: 6 });
    expect(result.pointCount).toBe(6);
  });

  it("rejects pointCount below 3", () => {
    expect(() => CreatePolygonInput.parse({ width: 100, height: 100, pointCount: 2 })).toThrow();
  });

  it("rejects pointCount above 20", () => {
    expect(() => CreatePolygonInput.parse({ width: 100, height: 100, pointCount: 21 })).toThrow();
  });
});

// ─── Text Schema Tests ───────────────────────────────────────────────────────

describe("CreateTextInput", () => {
  it("accepts minimal input", () => {
    const result = CreateTextInput.parse({ content: "Hello World" });
    expect(result.name).toBe("Text");
    expect(result.content).toBe("Hello World");
    expect(result.typography.fontFamily).toBe("Inter");
    expect(result.typography.fontSize).toBe(16);
  });

  it("accepts full typography", () => {
    const result = CreateTextInput.parse({
      name: "Heading",
      content: "Welcome",
      x: 100,
      y: 200,
      width: 400,
      typography: {
        fontFamily: "Roboto",
        fontStyle: "Bold",
        fontSize: 32,
        textAlign: "CENTER",
        letterSpacing: 1.5,
        lineHeight: { unit: "PIXELS", value: 40 },
      },
    });
    expect(result.typography.fontFamily).toBe("Roboto");
    expect(result.typography.fontSize).toBe(32);
    expect(result.width).toBe(400);
  });

  it("rejects empty content", () => {
    expect(() => CreateTextInput.parse({ content: "" })).toThrow();
  });

  it("rejects content over max length", () => {
    expect(() => CreateTextInput.parse({ content: "a".repeat(100001) })).toThrow();
  });
});

describe("UpdateTextInput", () => {
  it("accepts nodeId only", () => {
    const result = UpdateTextInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
    expect(result.content).toBeUndefined();
  });

  it("accepts content update", () => {
    const result = UpdateTextInput.parse({
      nodeId: "123:456",
      content: "New text",
    });
    expect(result.content).toBe("New text");
  });

  it("accepts partial typography update", () => {
    const result = UpdateTextInput.parse({
      nodeId: "123:456",
      typography: { fontSize: 24 },
    });
    expect(result.typography?.fontSize).toBe(24);
  });
});

// ─── Modify Schema Tests ─────────────────────────────────────────────────────

describe("UpdateNodeInput", () => {
  it("accepts nodeId with single update", () => {
    const result = UpdateNodeInput.parse({ nodeId: "123:456", opacity: 0.5 });
    expect(result.opacity).toBe(0.5);
  });

  it("accepts multiple updates", () => {
    const result = UpdateNodeInput.parse({
      nodeId: "123:456",
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      visible: false,
      name: "Updated",
    });
    expect(result.x).toBe(100);
    expect(result.visible).toBe(false);
  });

  it("rejects width of 0", () => {
    expect(() => UpdateNodeInput.parse({ nodeId: "123:456", width: 0 })).toThrow();
  });
});

describe("AddShadowInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = AddShadowInput.parse({ nodeId: "123:456" });
    expect(result.offsetY).toBe(4);
    expect(result.blur).toBe(8);
    expect(result.color.a).toBe(0.25);
  });

  it("accepts custom shadow", () => {
    const result = AddShadowInput.parse({
      nodeId: "123:456",
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offsetX: 2,
      offsetY: 6,
      blur: 16,
      spread: 2,
    });
    expect(result.blur).toBe(16);
    expect(result.spread).toBe(2);
  });
});

// ─── Style Tool Schema Tests ──────────────────────────────────────────────────

describe("SetFillInput", () => {
  it("accepts solid fill", () => {
    const result = SetFillInput.parse({
      nodeId: "1:1",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    });
    expect(result.fills).toHaveLength(1);
  });

  it("accepts empty fills (remove all)", () => {
    const result = SetFillInput.parse({ nodeId: "1:1", fills: [] });
    expect(result.fills).toHaveLength(0);
  });

  it("rejects missing fills", () => {
    expect(() => SetFillInput.parse({ nodeId: "1:1" })).toThrow();
  });
});

describe("SetStrokeInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = SetStrokeInput.parse({ nodeId: "1:1" });
    expect(result.strokeWeight).toBe(1);
    expect(result.strokeAlign).toBe("INSIDE");
  });

  it("accepts full stroke config", () => {
    const result = SetStrokeInput.parse({
      nodeId: "1:1",
      strokes: [{ color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: 2,
      strokeAlign: "OUTSIDE",
      dashPattern: [8, 4],
      strokeCap: "ROUND",
      strokeJoin: "BEVEL",
    });
    expect(result.dashPattern).toEqual([8, 4]);
    expect(result.strokeCap).toBe("ROUND");
  });

  it("rejects invalid strokeCap", () => {
    expect(() => SetStrokeInput.parse({
      nodeId: "1:1",
      strokeCap: "INVALID",
    })).toThrow();
  });
});

describe("SetCornerRadiusInput", () => {
  it("accepts individual corners", () => {
    const result = SetCornerRadiusInput.parse({
      nodeId: "1:1",
      topLeft: 8,
      topRight: 8,
      bottomRight: 0,
      bottomLeft: 0,
    });
    expect(result.topLeft).toBe(8);
    expect(result.bottomRight).toBe(0);
  });

  it("accepts cornerSmoothing", () => {
    const result = SetCornerRadiusInput.parse({
      nodeId: "1:1",
      topLeft: 16,
      cornerSmoothing: 0.6,
    });
    expect(result.cornerSmoothing).toBe(0.6);
  });

  it("rejects cornerSmoothing > 1", () => {
    expect(() => SetCornerRadiusInput.parse({ nodeId: "1:1", cornerSmoothing: 1.5 })).toThrow();
  });

  it("rejects negative radius", () => {
    expect(() => SetCornerRadiusInput.parse({ nodeId: "1:1", topLeft: -5 })).toThrow();
  });
});

describe("SetEffectsInput", () => {
  it("accepts drop shadow", () => {
    const result = SetEffectsInput.parse({
      nodeId: "1:1",
      effects: [{ type: "DROP_SHADOW" }],
    });
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].type).toBe("DROP_SHADOW");
  });

  it("accepts background blur", () => {
    const result = SetEffectsInput.parse({
      nodeId: "1:1",
      effects: [{ type: "BACKGROUND_BLUR", radius: 12 }],
    });
    expect(result.effects[0].type).toBe("BACKGROUND_BLUR");
  });

  it("accepts mixed effects", () => {
    const result = SetEffectsInput.parse({
      nodeId: "1:1",
      effects: [
        { type: "DROP_SHADOW", blur: 8 },
        { type: "BACKGROUND_BLUR", radius: 12 },
      ],
    });
    expect(result.effects).toHaveLength(2);
  });

  it("accepts empty effects (remove all)", () => {
    const result = SetEffectsInput.parse({ nodeId: "1:1", effects: [] });
    expect(result.effects).toHaveLength(0);
  });

  it("rejects missing effects", () => {
    expect(() => SetEffectsInput.parse({ nodeId: "1:1" })).toThrow();
  });
});

// ─── Layout Tool Schema Tests ─────────────────────────────────────────────────

describe("SetNodeLayoutPropertiesInput", () => {
  it("accepts layout sizing", () => {
    const result = SetNodeLayoutPropertiesInput.parse({
      nodeId: "1:1",
      layoutSizingHorizontal: "FILL",
      layoutSizingVertical: "HUG",
    });
    expect(result.layoutSizingHorizontal).toBe("FILL");
    expect(result.layoutSizingVertical).toBe("HUG");
  });

  it("accepts layout grow", () => {
    const result = SetNodeLayoutPropertiesInput.parse({
      nodeId: "1:1",
      layoutGrow: 1,
    });
    expect(result.layoutGrow).toBe(1);
  });

  it("accepts min/max constraints", () => {
    const result = SetNodeLayoutPropertiesInput.parse({
      nodeId: "1:1",
      minWidth: 100,
      maxWidth: 400,
    });
    expect(result.minWidth).toBe(100);
    expect(result.maxWidth).toBe(400);
  });

  it("rejects invalid layoutSizingHorizontal", () => {
    expect(() => SetNodeLayoutPropertiesInput.parse({
      nodeId: "1:1",
      layoutSizingHorizontal: "INVALID",
    })).toThrow();
  });

  it("rejects layoutGrow > 1", () => {
    expect(() => SetNodeLayoutPropertiesInput.parse({ nodeId: "1:1", layoutGrow: 2 })).toThrow();
  });
});

// ─── Organize Tool Schema Tests ───────────────────────────────────────────────

describe("GroupNodesInput", () => {
  it("accepts 2+ node IDs", () => {
    const result = GroupNodesInput.parse({
      nodeIds: ["1:1", "2:2"],
    });
    expect(result.nodeIds).toHaveLength(2);
    expect(result.name).toBe("Group");
  });

  it("rejects fewer than 2 nodes", () => {
    expect(() => GroupNodesInput.parse({ nodeIds: ["1:1"] })).toThrow();
  });

  it("rejects more than 100 nodes", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `${i}:0`);
    expect(() => GroupNodesInput.parse({ nodeIds: ids })).toThrow();
  });
});

describe("DeleteNodeInput", () => {
  it("accepts valid nodeId", () => {
    const result = DeleteNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });
});

describe("CreateComponentInput", () => {
  it("accepts valid nodeId", () => {
    const result = CreateComponentInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });
});

describe("CloneNodeInput", () => {
  it("accepts nodeId only", () => {
    const result = CloneNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
    expect(result.x).toBeUndefined();
  });

  it("accepts with position override", () => {
    const result = CloneNodeInput.parse({ nodeId: "123:456", x: 100, y: 200 });
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it("accepts parentId", () => {
    const result = CloneNodeInput.parse({ nodeId: "1:1", parentId: "2:2" });
    expect(result.parentId).toBe("2:2");
  });

  it("rejects extra properties", () => {
    expect(() => CloneNodeInput.parse({ nodeId: "1:1", extra: true })).toThrow();
  });
});

describe("ReorderNodeInput", () => {
  it("accepts valid input", () => {
    const result = ReorderNodeInput.parse({ nodeId: "1:1", index: 2 });
    expect(result.index).toBe(2);
  });

  it("accepts index 0 (back)", () => {
    const result = ReorderNodeInput.parse({ nodeId: "1:1", index: 0 });
    expect(result.index).toBe(0);
  });

  it("rejects negative index", () => {
    expect(() => ReorderNodeInput.parse({ nodeId: "1:1", index: -1 })).toThrow();
  });

  it("rejects non-integer index", () => {
    expect(() => ReorderNodeInput.parse({ nodeId: "1:1", index: 1.5 })).toThrow();
  });
});

// ─── Component Tool Schema Tests ─────────────────────────────────────────────

describe("CreateComponentInstanceInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreateComponentInstanceInput.parse({ componentId: "5:10" });
    expect(result.componentId).toBe("5:10");
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("accepts with position and parent", () => {
    const result = CreateComponentInstanceInput.parse({
      componentId: "5:10",
      x: 100,
      y: 200,
      parentId: "1:1",
    });
    expect(result.x).toBe(100);
    expect(result.parentId).toBe("1:1");
  });

  it("rejects missing componentId", () => {
    expect(() => CreateComponentInstanceInput.parse({})).toThrow();
  });
});

describe("GetLocalComponentsInput", () => {
  it("accepts empty object", () => {
    expect(GetLocalComponentsInput.parse({})).toEqual({});
  });
});

describe("ListAvailableFontsInput", () => {
  it("accepts empty object", () => {
    expect(ListAvailableFontsInput.parse({})).toEqual({});
  });
});

// ─── Viewport Schema Tests ──────────────────────────────────────────────────

describe("ZoomToNodeInput", () => {
  it("accepts valid nodeId", () => {
    const result = ZoomToNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });
});

// ─── Style System Tool Schema Tests ──────────────────────────────────────────

describe("CreatePaintStyleInput", () => {
  it("accepts valid input", () => {
    const result = CreatePaintStyleInput.parse({
      name: "Primary/500",
      paints: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 1 } }],
    });
    expect(result.name).toBe("Primary/500");
    expect(result.paints).toHaveLength(1);
  });

  it("rejects empty name", () => {
    expect(() => CreatePaintStyleInput.parse({
      name: "",
      paints: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
    })).toThrow();
  });

  it("rejects empty paints", () => {
    expect(() => CreatePaintStyleInput.parse({ name: "Test", paints: [] })).toThrow();
  });
});

describe("CreateTextStyleInput", () => {
  it("accepts valid input", () => {
    const result = CreateTextStyleInput.parse({
      name: "Heading/H1",
      typography: {
        fontFamily: "Inter",
        fontStyle: "Bold",
        fontSize: 48,
        textAlign: "LEFT",
        letterSpacing: 0,
        lineHeight: { unit: "AUTO" },
      },
    });
    expect(result.name).toBe("Heading/H1");
    expect(result.typography.fontSize).toBe(48);
  });
});

describe("GetLocalStylesInput", () => {
  it("accepts empty object", () => {
    expect(GetLocalStylesInput.parse({})).toEqual({});
  });
});

describe("ApplyStyleInput", () => {
  it("accepts fillStyleId", () => {
    const result = ApplyStyleInput.parse({
      nodeId: "1:1",
      fillStyleId: "S:abc123",
    });
    expect(result.fillStyleId).toBe("S:abc123");
  });

  it("accepts multiple style ids", () => {
    const result = ApplyStyleInput.parse({
      nodeId: "1:1",
      fillStyleId: "S:fill",
      effectStyleId: "S:effect",
    });
    expect(result.fillStyleId).toBe("S:fill");
    expect(result.effectStyleId).toBe("S:effect");
  });

  it("accepts nodeId with no style IDs", () => {
    const result = ApplyStyleInput.parse({ nodeId: "1:1" });
    expect(result.nodeId).toBe("1:1");
    expect(result.fillStyleId).toBeUndefined();
  });
});

// ─── Image Tool Schema Tests ─────────────────────────────────────────────────

describe("SetImageFillInput", () => {
  it("accepts valid input", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "abc123base64data==",
    });
    expect(result.scaleMode).toBe("FILL");
  });

  it("accepts FIT scale mode", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      scaleMode: "FIT",
    });
    expect(result.scaleMode).toBe("FIT");
  });

  it("rejects missing imageData", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1" })).toThrow();
  });

  it("rejects empty imageData", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "" })).toThrow();
  });

  it("rejects invalid scaleMode", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", scaleMode: "STRETCH" })).toThrow();
  });

  it("accepts focalPointX and focalPointY", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      focalPointX: 0.75,
      focalPointY: 0.25,
    });
    expect(result.focalPointX).toBe(0.75);
    expect(result.focalPointY).toBe(0.25);
  });

  it("defaults focalPointX and focalPointY to undefined", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
    });
    expect(result.focalPointX).toBeUndefined();
    expect(result.focalPointY).toBeUndefined();
  });

  it("rejects focalPointX out of range", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", focalPointX: 1.5 })).toThrow();
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", focalPointX: -0.1 })).toThrow();
  });

  it("rejects focalPointY out of range", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", focalPointY: 2 })).toThrow();
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", focalPointY: -1 })).toThrow();
  });

  it("accepts zoom parameter", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      zoom: 2.5,
    });
    expect(result.zoom).toBe(2.5);
  });

  it("rejects zoom out of range", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", zoom: 0 })).toThrow();
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", zoom: 11 })).toThrow();
  });

  it("accepts preserveFills flag", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      preserveFills: true,
    });
    expect(result.preserveFills).toBe(true);
  });

  it("defaults preserveFills to false", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
    });
    expect(result.preserveFills).toBe(false);
  });

  it("accepts opacity parameter", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      opacity: 0.5,
    });
    expect(result.opacity).toBe(0.5);
  });

  it("defaults opacity to 1", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
    });
    expect(result.opacity).toBe(1);
  });

  it("rejects opacity out of range", () => {
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", opacity: 1.5 })).toThrow();
    expect(() => SetImageFillInput.parse({ nodeId: "1:1", imageData: "data", opacity: -0.1 })).toThrow();
  });

  it("accepts all new params together", () => {
    const result = SetImageFillInput.parse({
      nodeId: "1:1",
      imageData: "data",
      scaleMode: "CROP",
      focalPointX: 0.8,
      focalPointY: 0.2,
      zoom: 3,
      preserveFills: true,
      opacity: 0.7,
    });
    expect(result.focalPointX).toBe(0.8);
    expect(result.focalPointY).toBe(0.2);
    expect(result.zoom).toBe(3);
    expect(result.preserveFills).toBe(true);
    expect(result.opacity).toBe(0.7);
  });
});

describe("SetImageFromUrlInput", () => {
  it("accepts valid URL with default scaleMode", () => {
    const result = SetImageFromUrlInput.parse({
      nodeId: "1:1",
      url: "https://example.com/photo.png",
    });
    expect(result.scaleMode).toBe("FILL");
    expect(result.url).toBe("https://example.com/photo.png");
  });

  it("accepts URL with explicit scaleMode", () => {
    const result = SetImageFromUrlInput.parse({
      nodeId: "1:1",
      url: "https://cdn.example.com/img.jpg",
      scaleMode: "FIT",
    });
    expect(result.scaleMode).toBe("FIT");
  });

  it("rejects missing url", () => {
    expect(() => SetImageFromUrlInput.parse({ nodeId: "1:1" })).toThrow();
  });

  it("rejects invalid url", () => {
    expect(() => SetImageFromUrlInput.parse({ nodeId: "1:1", url: "not-a-url" })).toThrow();
  });

  it("rejects empty url", () => {
    expect(() => SetImageFromUrlInput.parse({ nodeId: "1:1", url: "" })).toThrow();
  });

  it("rejects invalid scaleMode", () => {
    expect(() =>
      SetImageFromUrlInput.parse({ nodeId: "1:1", url: "https://example.com/img.png", scaleMode: "STRETCH" }),
    ).toThrow();
  });

  it("rejects extra properties", () => {
    expect(() =>
      SetImageFromUrlInput.parse({ nodeId: "1:1", url: "https://example.com/img.png", extra: true }),
    ).toThrow();
  });

  it("accepts focal point and zoom params", () => {
    const result = SetImageFromUrlInput.parse({
      nodeId: "1:1",
      url: "https://example.com/img.png",
      focalPointX: 0,
      focalPointY: 1,
      zoom: 5,
    });
    expect(result.focalPointX).toBe(0);
    expect(result.focalPointY).toBe(1);
    expect(result.zoom).toBe(5);
  });

  it("accepts preserveFills and opacity", () => {
    const result = SetImageFromUrlInput.parse({
      nodeId: "1:1",
      url: "https://example.com/img.png",
      preserveFills: true,
      opacity: 0.3,
    });
    expect(result.preserveFills).toBe(true);
    expect(result.opacity).toBe(0.3);
  });

  it("defaults preserveFills to false and opacity to 1", () => {
    const result = SetImageFromUrlInput.parse({
      nodeId: "1:1",
      url: "https://example.com/img.png",
    });
    expect(result.preserveFills).toBe(false);
    expect(result.opacity).toBe(1);
  });
});

describe("SetImageFromPathInput", () => {
  it("accepts valid file path with default scaleMode", () => {
    const result = SetImageFromPathInput.parse({
      nodeId: "1:1",
      filePath: "/Users/me/photo.png",
    });
    expect(result.scaleMode).toBe("FILL");
    expect(result.filePath).toBe("/Users/me/photo.png");
  });

  it("accepts file path with explicit scaleMode", () => {
    const result = SetImageFromPathInput.parse({
      nodeId: "1:1",
      filePath: "C:\\Users\\me\\image.jpg",
      scaleMode: "CROP",
    });
    expect(result.scaleMode).toBe("CROP");
  });

  it("rejects missing filePath", () => {
    expect(() => SetImageFromPathInput.parse({ nodeId: "1:1" })).toThrow();
  });

  it("rejects empty filePath", () => {
    expect(() => SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "" })).toThrow();
  });

  it("rejects invalid scaleMode", () => {
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", scaleMode: "STRETCH" }),
    ).toThrow();
  });

  it("rejects extra properties", () => {
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", extra: true }),
    ).toThrow();
  });

  it("accepts focal point, zoom, preserveFills, and opacity", () => {
    const result = SetImageFromPathInput.parse({
      nodeId: "1:1",
      filePath: "/tmp/img.png",
      scaleMode: "FILL",
      focalPointX: 0.5,
      focalPointY: 0.5,
      zoom: 1.5,
      preserveFills: true,
      opacity: 0.8,
    });
    expect(result.focalPointX).toBe(0.5);
    expect(result.focalPointY).toBe(0.5);
    expect(result.zoom).toBe(1.5);
    expect(result.preserveFills).toBe(true);
    expect(result.opacity).toBe(0.8);
  });

  it("defaults preserveFills to false and opacity to 1", () => {
    const result = SetImageFromPathInput.parse({
      nodeId: "1:1",
      filePath: "/tmp/img.png",
    });
    expect(result.preserveFills).toBe(false);
    expect(result.opacity).toBe(1);
  });

  it("rejects focalPointX out of range", () => {
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", focalPointX: 1.1 }),
    ).toThrow();
  });

  it("rejects zoom out of range", () => {
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", zoom: 0 }),
    ).toThrow();
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", zoom: 11 }),
    ).toThrow();
  });

  it("rejects opacity out of range", () => {
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", opacity: -0.5 }),
    ).toThrow();
    expect(() =>
      SetImageFromPathInput.parse({ nodeId: "1:1", filePath: "/tmp/img.png", opacity: 1.1 }),
    ).toThrow();
  });
});

// ─── Export Tool Schema Tests ─────────────────────────────────────────────────

describe("ExportNodeInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = ExportNodeInput.parse({ nodeId: "1:1" });
    expect(result.format).toBe("PNG");
    expect(result.scale).toBe(1);
  });

  it("accepts SVG format", () => {
    const result = ExportNodeInput.parse({ nodeId: "1:1", format: "SVG" });
    expect(result.format).toBe("SVG");
  });

  it("accepts scale 2x", () => {
    const result = ExportNodeInput.parse({ nodeId: "1:1", scale: 2 });
    expect(result.scale).toBe(2);
  });

  it("rejects scale > 4", () => {
    expect(() => ExportNodeInput.parse({ nodeId: "1:1", scale: 5 })).toThrow();
  });

  it("rejects invalid format", () => {
    expect(() => ExportNodeInput.parse({ nodeId: "1:1", format: "WEBP" })).toThrow();
  });
});

// ─── Typography Tool Schema Tests ─────────────────────────────────────────────

describe("SetTextDecorationInput", () => {
  it("accepts UNDERLINE", () => {
    const result = SetTextDecorationInput.parse({ nodeId: "1:1", textDecoration: "UNDERLINE" });
    expect(result.textDecoration).toBe("UNDERLINE");
  });

  it("accepts STRIKETHROUGH", () => {
    const result = SetTextDecorationInput.parse({ nodeId: "1:1", textDecoration: "STRIKETHROUGH" });
    expect(result.textDecoration).toBe("STRIKETHROUGH");
  });

  it("accepts NONE", () => {
    const result = SetTextDecorationInput.parse({ nodeId: "1:1", textDecoration: "NONE" });
    expect(result.textDecoration).toBe("NONE");
  });

  it("rejects invalid decoration", () => {
    expect(() => SetTextDecorationInput.parse({ nodeId: "1:1", textDecoration: "BOLD" })).toThrow();
  });
});

describe("SetTextCaseInput", () => {
  it("accepts all valid values", () => {
    for (const v of ["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS"]) {
      const result = SetTextCaseInput.parse({ nodeId: "1:1", textCase: v });
      expect(result.textCase).toBe(v);
    }
  });

  it("rejects invalid case", () => {
    expect(() => SetTextCaseInput.parse({ nodeId: "1:1", textCase: "CAMEL" })).toThrow();
  });
});

describe("SetTextListInput", () => {
  it("accepts UNORDERED", () => {
    const result = SetTextListInput.parse({ nodeId: "1:1", listType: "UNORDERED" });
    expect(result.listType).toBe("UNORDERED");
  });

  it("accepts ORDERED and NONE", () => {
    expect(SetTextListInput.parse({ nodeId: "1:1", listType: "ORDERED" }).listType).toBe("ORDERED");
    expect(SetTextListInput.parse({ nodeId: "1:1", listType: "NONE" }).listType).toBe("NONE");
  });
});

// ─── Constraint Tool Schema Tests ─────────────────────────────────────────────

describe("SetConstraintsInput", () => {
  it("accepts valid constraints", () => {
    const result = SetConstraintsInput.parse({
      nodeId: "1:1",
      horizontal: "MIN",
      vertical: "MAX",
    });
    expect(result.horizontal).toBe("MIN");
    expect(result.vertical).toBe("MAX");
  });

  it("accepts STRETCH and SCALE", () => {
    const result = SetConstraintsInput.parse({
      nodeId: "1:1",
      horizontal: "STRETCH",
      vertical: "SCALE",
    });
    expect(result.horizontal).toBe("STRETCH");
  });

  it("rejects invalid axis value", () => {
    expect(() => SetConstraintsInput.parse({
      nodeId: "1:1",
      horizontal: "LEFT",
      vertical: "TOP",
    })).toThrow();
  });
});

describe("SetLayoutGridsInput", () => {
  it("accepts column grid", () => {
    const result = SetLayoutGridsInput.parse({
      nodeId: "1:1",
      grids: [{
        pattern: "COLUMNS",
        count: 12,
        gutterSize: 16,
        offset: 0,
        alignment: "STRETCH",
      }],
    });
    expect(result.grids).toHaveLength(1);
    expect(result.grids[0].pattern).toBe("COLUMNS");
    expect(result.grids[0].count).toBe(12);
  });

  it("accepts empty grids (remove all)", () => {
    const result = SetLayoutGridsInput.parse({ nodeId: "1:1", grids: [] });
    expect(result.grids).toHaveLength(0);
  });

  it("rejects invalid pattern", () => {
    expect(() => SetLayoutGridsInput.parse({
      nodeId: "1:1",
      grids: [{ pattern: "DIAGONAL" }],
    })).toThrow();
  });
});

// ─── Batch Tool Schema Tests ──────────────────────────────────────────────────

describe("BatchCreateInput", () => {
  it("accepts valid create operations", () => {
    const result = BatchCreateInput.parse({
      operations: [
        { command: "create_frame", args: { name: "Frame 1", width: 100, height: 100 } },
        { command: "create_rectangle", args: { width: 50, height: 50 } },
      ],
    });
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0].command).toBe("create_frame");
  });

  it("rejects empty operations", () => {
    expect(() => BatchCreateInput.parse({ operations: [] })).toThrow();
  });

  it("rejects invalid command", () => {
    expect(() => BatchCreateInput.parse({
      operations: [{ command: "delete_all", args: {} }],
    })).toThrow();
  });

  it("rejects over 50 operations", () => {
    const ops = Array.from({ length: 51 }, () => ({
      command: "create_rectangle" as const,
      args: { width: 10, height: 10 },
    }));
    expect(() => BatchCreateInput.parse({ operations: ops })).toThrow();
  });
});

describe("BatchUpdateInput", () => {
  it("accepts valid updates", () => {
    const result = BatchUpdateInput.parse({
      updates: [
        { nodeId: "1:1", x: 10, y: 20 },
        { nodeId: "2:2", opacity: 0.5 },
      ],
    });
    expect(result.updates).toHaveLength(2);
    expect(result.updates[0].x).toBe(10);
  });

  it("rejects empty updates", () => {
    expect(() => BatchUpdateInput.parse({ updates: [] })).toThrow();
  });
});

// ─── Vector Tool Schema Tests ─────────────────────────────────────────────────

describe("CreateVectorInput", () => {
  it("accepts valid SVG path", () => {
    const result = CreateVectorInput.parse({
      vectorPaths: [{ data: "M 0 0 L 100 0 L 50 100 Z" }],
    });
    expect(result.vectorPaths).toHaveLength(1);
    expect(result.name).toBe("Vector");
  });

  it("accepts custom winding rule", () => {
    const result = CreateVectorInput.parse({
      vectorPaths: [{ data: "M 0 0 L 100 0 Z", windingRule: "NONZERO" }],
    });
    expect(result.vectorPaths[0].windingRule).toBe("NONZERO");
  });

  it("rejects empty vectorPaths", () => {
    expect(() => CreateVectorInput.parse({ vectorPaths: [] })).toThrow();
  });
});

describe("CreateBooleanOperationInput", () => {
  it("accepts UNION operation", () => {
    const result = CreateBooleanOperationInput.parse({
      nodeIds: ["1:1", "2:2"],
      operation: "UNION",
    });
    expect(result.operation).toBe("UNION");
  });

  it("accepts all operations", () => {
    for (const op of ["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]) {
      const r = CreateBooleanOperationInput.parse({ nodeIds: ["1:1", "2:2"], operation: op });
      expect(r.operation).toBe(op);
    }
  });

  it("rejects fewer than 2 nodes", () => {
    expect(() => CreateBooleanOperationInput.parse({ nodeIds: ["1:1"], operation: "UNION" })).toThrow();
  });

  it("rejects invalid operation", () => {
    expect(() => CreateBooleanOperationInput.parse({
      nodeIds: ["1:1", "2:2"],
      operation: "MERGE",
    })).toThrow();
  });
});

// ─── Page Tool Schema Tests ───────────────────────────────────────────────────

describe("CreatePageInput", () => {
  it("accepts valid name", () => {
    const result = CreatePageInput.parse({ name: "Mobile" });
    expect(result.name).toBe("Mobile");
  });

  it("uses default name", () => {
    const result = CreatePageInput.parse({});
    expect(result.name).toBe("Page");
  });
});

describe("CreateSectionInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreateSectionInput.parse({});
    expect(result.name).toBe("Section");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("accepts full input", () => {
    const result = CreateSectionInput.parse({
      name: "Auth Flow",
      x: 100,
      y: 200,
      width: 1200,
      height: 800,
      fillColor: { r: 0.95, g: 0.95, b: 1 },
    });
    expect(result.name).toBe("Auth Flow");
    expect(result.fillColor?.r).toBe(0.95);
  });
});

// ─── Traversal Tool Schema Tests ──────────────────────────────────────────────

describe("FindNodesInput", () => {
  it("accepts empty input with defaults", () => {
    const result = FindNodesInput.parse({});
    expect(result.maxResults).toBe(50);
    expect(result.types).toBeUndefined();
  });

  it("accepts type filter", () => {
    const result = FindNodesInput.parse({ types: ["FRAME", "TEXT"] });
    expect(result.types).toEqual(["FRAME", "TEXT"]);
  });

  it("accepts name pattern", () => {
    const result = FindNodesInput.parse({ namePattern: "Button" });
    expect(result.namePattern).toBe("Button");
  });

  it("accepts scoped search", () => {
    const result = FindNodesInput.parse({ parentId: "1:1", types: ["TEXT"] });
    expect(result.parentId).toBe("1:1");
  });

  it("rejects maxResults > 200", () => {
    expect(() => FindNodesInput.parse({ maxResults: 201 })).toThrow();
  });
});

// ─── Variable Tool Schema Tests ───────────────────────────────────────────────

describe("CreateVariableCollectionInput", () => {
  it("accepts minimal input", () => {
    const result = CreateVariableCollectionInput.parse({ name: "Colors" });
    expect(result.name).toBe("Colors");
    expect(result.modes).toEqual(["Default"]);
  });

  it("accepts multiple modes", () => {
    const result = CreateVariableCollectionInput.parse({
      name: "Colors",
      modes: ["Light", "Dark"],
    });
    expect(result.modes).toEqual(["Light", "Dark"]);
  });

  it("rejects empty name", () => {
    expect(() => CreateVariableCollectionInput.parse({ name: "" })).toThrow();
  });

  it("rejects empty modes array", () => {
    expect(() => CreateVariableCollectionInput.parse({ name: "Colors", modes: [] })).toThrow();
  });
});

describe("CreateVariableInput", () => {
  it("accepts COLOR variable", () => {
    const result = CreateVariableInput.parse({
      name: "Primary",
      collectionId: "collection:1",
      type: "COLOR",
    });
    expect(result.type).toBe("COLOR");
  });

  it("accepts FLOAT variable with values", () => {
    const result = CreateVariableInput.parse({
      name: "Spacing/4",
      collectionId: "collection:1",
      type: "FLOAT",
      values: { modeId1: 4 },
    });
    expect(result.values?.modeId1).toBe(4);
  });

  it("rejects invalid type", () => {
    expect(() => CreateVariableInput.parse({
      name: "Test",
      collectionId: "col:1",
      type: "NUMBER",
    })).toThrow();
  });
});

describe("BindVariableInput", () => {
  it("accepts valid input", () => {
    const result = BindVariableInput.parse({
      nodeId: "1:1",
      property: "fills",
      variableId: "var:1",
    });
    expect(result.property).toBe("fills");
    expect(result.variableId).toBe("var:1");
  });

  it("rejects missing fields", () => {
    expect(() => BindVariableInput.parse({ nodeId: "1:1" })).toThrow();
  });
});

// ─── Fill discriminated union tests ──────────────────────────────────────────

describe("Fill (discriminated union)", () => {
  it("accepts SOLID fill", () => {
    const result = CreateRectangleInput.parse({
      width: 100,
      height: 100,
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
    });
    expect(result.fills[0].type).toBe("SOLID");
  });

  it("accepts gradient fill", () => {
    const result = CreateRectangleInput.parse({
      width: 100,
      height: 100,
      fills: [{
        type: "GRADIENT_LINEAR",
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0 } },
          { position: 1, color: { r: 0, g: 0, b: 1 } },
        ],
      }],
    });
    expect(result.fills[0].type).toBe("GRADIENT_LINEAR");
  });

  it("rejects gradient with fewer than 2 stops", () => {
    expect(() => CreateRectangleInput.parse({
      width: 100,
      height: 100,
      fills: [{
        type: "GRADIENT_LINEAR",
        gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0 } }],
      }],
    })).toThrow();
  });
});

// ─── Phase 4: Workflow Tool Schema Tests ──────────────────────────────────────

describe("FlattenNodeInput", () => {
  it("accepts valid nodeId", () => {
    const result = FlattenNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });

  it("rejects missing nodeId", () => {
    expect(() => FlattenNodeInput.parse({})).toThrow();
  });
});

describe("UngroupNodesInput", () => {
  it("accepts valid nodeId", () => {
    const result = UngroupNodesInput.parse({ nodeId: "1:1" });
    expect(result.nodeId).toBe("1:1");
  });
});

describe("SetSelectionInput", () => {
  it("accepts array of nodeIds", () => {
    const result = SetSelectionInput.parse({ nodeIds: ["1:1", "2:2"] });
    expect(result.nodeIds).toHaveLength(2);
  });

  it("accepts empty array to clear selection", () => {
    const result = SetSelectionInput.parse({ nodeIds: [] });
    expect(result.nodeIds).toHaveLength(0);
  });

  it("rejects more than 100 nodeIds", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `${i}:0`);
    expect(() => SetSelectionInput.parse({ nodeIds: ids })).toThrow();
  });
});

describe("SetCurrentPageInput", () => {
  it("accepts valid pageId", () => {
    const result = SetCurrentPageInput.parse({ pageId: "1:1" });
    expect(result.pageId).toBe("1:1");
  });

  it("rejects missing pageId", () => {
    expect(() => SetCurrentPageInput.parse({})).toThrow();
  });
});

describe("CreateEffectStyleInput", () => {
  it("accepts valid effect style", () => {
    const result = CreateEffectStyleInput.parse({
      name: "Elevation/Low",
      effects: [{ type: "DROP_SHADOW" }],
    });
    expect(result.name).toBe("Elevation/Low");
    expect(result.effects).toHaveLength(1);
  });

  it("rejects empty name", () => {
    expect(() => CreateEffectStyleInput.parse({
      name: "",
      effects: [{ type: "DROP_SHADOW" }],
    })).toThrow();
  });

  it("rejects empty effects", () => {
    expect(() => CreateEffectStyleInput.parse({ name: "Test", effects: [] })).toThrow();
  });
});

describe("GetVariablesInput", () => {
  it("accepts empty object", () => {
    expect(GetVariablesInput.parse({})).toEqual({});
  });

  it("rejects extra properties", () => {
    expect(() => GetVariablesInput.parse({ extra: true })).toThrow();
  });
});

// ─── Phase 5: Design System Tool Schema Tests ────────────────────────────────

describe("CombineAsVariantsInput", () => {
  it("accepts 2+ component IDs", () => {
    const result = CombineAsVariantsInput.parse({ nodeIds: ["1:1", "2:2"] });
    expect(result.nodeIds).toHaveLength(2);
  });

  it("accepts optional name", () => {
    const result = CombineAsVariantsInput.parse({ nodeIds: ["1:1", "2:2"], name: "Button" });
    expect(result.name).toBe("Button");
  });

  it("rejects fewer than 2 nodes", () => {
    expect(() => CombineAsVariantsInput.parse({ nodeIds: ["1:1"] })).toThrow();
  });
});

describe("DetachInstanceInput", () => {
  it("accepts valid nodeId", () => {
    const result = DetachInstanceInput.parse({ nodeId: "1:1" });
    expect(result.nodeId).toBe("1:1");
  });
});

describe("SwapComponentInput", () => {
  it("accepts valid input", () => {
    const result = SwapComponentInput.parse({ nodeId: "1:1", newComponentId: "2:2" });
    expect(result.nodeId).toBe("1:1");
    expect(result.newComponentId).toBe("2:2");
  });

  it("rejects missing newComponentId", () => {
    expect(() => SwapComponentInput.parse({ nodeId: "1:1" })).toThrow();
  });
});

describe("ImportComponentByKeyInput", () => {
  it("accepts valid key", () => {
    const result = ImportComponentByKeyInput.parse({ key: "abc123def456" });
    expect(result.key).toBe("abc123def456");
  });

  it("rejects empty key", () => {
    expect(() => ImportComponentByKeyInput.parse({ key: "" })).toThrow();
  });
});

// ─── Phase 6: Manipulation Tool Schema Tests ─────────────────────────────────

describe("SetRotationInput", () => {
  it("accepts valid rotation", () => {
    const result = SetRotationInput.parse({ nodeId: "1:1", rotation: 45 });
    expect(result.rotation).toBe(45);
  });

  it("accepts negative rotation", () => {
    const result = SetRotationInput.parse({ nodeId: "1:1", rotation: -90 });
    expect(result.rotation).toBe(-90);
  });

  it("rejects rotation > 360", () => {
    expect(() => SetRotationInput.parse({ nodeId: "1:1", rotation: 361 })).toThrow();
  });

  it("rejects rotation < -360", () => {
    expect(() => SetRotationInput.parse({ nodeId: "1:1", rotation: -361 })).toThrow();
  });
});

describe("SetBlendModeInput", () => {
  it("accepts MULTIPLY", () => {
    const result = SetBlendModeInput.parse({ nodeId: "1:1", blendMode: "MULTIPLY" });
    expect(result.blendMode).toBe("MULTIPLY");
  });

  it("accepts NORMAL", () => {
    const result = SetBlendModeInput.parse({ nodeId: "1:1", blendMode: "NORMAL" });
    expect(result.blendMode).toBe("NORMAL");
  });

  it("accepts all valid blend modes", () => {
    for (const mode of ["DARKEN", "SCREEN", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "COLOR_DODGE", "COLOR_BURN", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]) {
      const r = SetBlendModeInput.parse({ nodeId: "1:1", blendMode: mode });
      expect(r.blendMode).toBe(mode);
    }
  });

  it("rejects invalid blend mode", () => {
    expect(() => SetBlendModeInput.parse({ nodeId: "1:1", blendMode: "DISSOLVE" })).toThrow();
  });
});

describe("LockNodeInput", () => {
  it("accepts locked=true", () => {
    const result = LockNodeInput.parse({ nodeId: "1:1", locked: true });
    expect(result.locked).toBe(true);
  });

  it("accepts locked=false", () => {
    const result = LockNodeInput.parse({ nodeId: "1:1", locked: false });
    expect(result.locked).toBe(false);
  });

  it("rejects missing locked", () => {
    expect(() => LockNodeInput.parse({ nodeId: "1:1" })).toThrow();
  });
});

// ─── Phase 6: Extra Shape Tool Schema Tests ──────────────────────────────────

describe("CreateStarInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = CreateStarInput.parse({});
    expect(result.name).toBe("Star");
    expect(result.pointCount).toBe(5);
    expect(result.innerRadius).toBeCloseTo(0.382);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it("accepts custom star", () => {
    const result = CreateStarInput.parse({
      name: "Badge",
      pointCount: 8,
      innerRadius: 0.5,
      width: 200,
      height: 200,
    });
    expect(result.pointCount).toBe(8);
    expect(result.innerRadius).toBe(0.5);
  });

  it("rejects pointCount below 3", () => {
    expect(() => CreateStarInput.parse({ pointCount: 2 })).toThrow();
  });

  it("rejects innerRadius outside 0-1 range", () => {
    expect(() => CreateStarInput.parse({ innerRadius: 0 })).toThrow();
    expect(() => CreateStarInput.parse({ innerRadius: 1 })).toThrow();
  });
});

describe("CreateSvgNodeInput", () => {
  it("accepts valid SVG", () => {
    const result = CreateSvgNodeInput.parse({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
    });
    expect(result.svg).toContain("<svg");
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("accepts with name and position", () => {
    const result = CreateSvgNodeInput.parse({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      name: "Icon",
      x: 100,
      y: 200,
    });
    expect(result.name).toBe("Icon");
    expect(result.x).toBe(100);
  });

  it("rejects empty SVG", () => {
    expect(() => CreateSvgNodeInput.parse({ svg: "" })).toThrow();
  });

  it("rejects SVG over 64KB", () => {
    expect(() => CreateSvgNodeInput.parse({ svg: "a".repeat(65537) })).toThrow();
  });
});

describe("NotifyInput", () => {
  it("accepts minimal input with defaults", () => {
    const result = NotifyInput.parse({ message: "Done!" });
    expect(result.message).toBe("Done!");
    expect(result.error).toBe(false);
    expect(result.timeout).toBe(4000);
  });

  it("accepts error toast", () => {
    const result = NotifyInput.parse({ message: "Failed", error: true });
    expect(result.error).toBe(true);
  });

  it("accepts custom timeout", () => {
    const result = NotifyInput.parse({ message: "Processing...", timeout: 10000 });
    expect(result.timeout).toBe(10000);
  });

  it("rejects empty message", () => {
    expect(() => NotifyInput.parse({ message: "" })).toThrow();
  });

  it("rejects timeout < 1000ms", () => {
    expect(() => NotifyInput.parse({ message: "Test", timeout: 500 })).toThrow();
  });

  it("rejects timeout > 30000ms", () => {
    expect(() => NotifyInput.parse({ message: "Test", timeout: 31000 })).toThrow();
  });
});
