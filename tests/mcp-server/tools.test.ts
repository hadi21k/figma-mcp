import { describe, it, expect } from "vitest";
import {
  TOOL_REGISTRY,
  CreateFrameInput,
  CreateRectangleInput,
  CreateEllipseInput,
  CreateTextInput,
  UpdateTextInput,
  UpdateNodeInput,
  AddShadowInput,
  GroupNodesInput,
  DeleteNodeInput,
  CreateComponentInput,
  ZoomToNodeInput,
  SetAutoLayoutInput,
  GetNodeInput,
  GetDocumentInfoInput,
  GetSelectionInput,
  RGBAColor,
  NodeId,
} from "../../src/mcp-server/tools/index.js";

// ─── Tool Registry Tests ─────────────────────────────────────────────────────

describe("Tool Registry", () => {
  it("contains all 15 tools", () => {
    const tools = Object.keys(TOOL_REGISTRY);
    expect(tools).toHaveLength(15);
  });

  const expectedTools = [
    "get_document_info", "get_selection", "get_node",
    "create_frame", "set_auto_layout",
    "create_rectangle", "create_ellipse",
    "create_text", "update_text",
    "update_node", "add_shadow", "group_nodes", "delete_node",
    "create_component", "zoom_to_node",
  ];

  it.each(expectedTools)("has tool '%s'", (toolName) => {
    expect(TOOL_REGISTRY[toolName]).toBeDefined();
    expect(TOOL_REGISTRY[toolName].description).toBeTruthy();
    expect(TOOL_REGISTRY[toolName].inputSchema).toBeDefined();
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
    expect(result.x).toBe(0); // default
    expect(result.y).toBe(0); // default
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
  });

  it("accepts full input with padding", () => {
    const result = SetAutoLayoutInput.parse({
      nodeId: "123:456",
      direction: "HORIZONTAL",
      gap: 16,
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      primaryAxisAlign: "SPACE_BETWEEN",
      counterAxisAlign: "CENTER",
    });
    expect(result.gap).toBe(16);
    expect(result.padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
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
    expect(result.typography?.fontFamily).toBeUndefined();
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

// ─── Component Schema Tests ──────────────────────────────────────────────────

describe("CreateComponentInput", () => {
  it("accepts valid nodeId", () => {
    const result = CreateComponentInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
  });
});

// ─── Viewport Schema Tests ──────────────────────────────────────────────────

describe("ZoomToNodeInput", () => {
  it("accepts valid nodeId", () => {
    const result = ZoomToNodeInput.parse({ nodeId: "123:456" });
    expect(result.nodeId).toBe("123:456");
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
