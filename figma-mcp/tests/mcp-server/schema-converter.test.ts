import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema, isOptional } from "../../src/mcp-server/schema-converter.js";

describe("zodToJsonSchema", () => {
  it("converts ZodObject to JSON schema", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        name: { type: "string", description: undefined },
        age: { type: "number", description: undefined },
      },
      required: ["name", "age"],
    });
  });

  it("handles optional fields", () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    });
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        name: { type: "string", description: undefined },
        nickname: { type: "string", description: undefined },
      },
      required: ["name"],
    });
  });

  it("handles default fields", () => {
    const schema = z.object({
      name: z.string(),
      role: z.string().default("user"),
    });
    const result = zodToJsonSchema(schema);

    expect((result as Record<string, unknown>).required).toEqual(["name"]);
    const props = (result as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props.role.default).toBe("user");
  });

  it("converts ZodString with description", () => {
    const schema = z.string().describe("A name");
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({ type: "string", description: "A name" });
  });

  it("converts ZodNumber", () => {
    const schema = z.number();
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({ type: "number", description: undefined });
  });

  it("converts ZodBoolean", () => {
    const schema = z.boolean();
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({ type: "boolean" });
  });

  it("converts ZodArray", () => {
    const schema = z.array(z.string());
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({
      type: "array",
      items: { type: "string", description: undefined },
    });
  });

  it("converts ZodEnum", () => {
    const schema = z.enum(["A", "B", "C"]);
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({ type: "string", enum: ["A", "B", "C"] });
  });

  it("converts ZodLiteral", () => {
    const schema = z.literal("SOLID");
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({ type: "string", const: "SOLID" });
  });

  it("converts ZodUnion", () => {
    const schema = z.union([z.string(), z.number()]);
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({
      oneOf: [
        { type: "string", description: undefined },
        { type: "number", description: undefined },
      ],
    });
  });

  it("converts discriminated union", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("A"), val: z.string() }),
      z.object({ type: z.literal("B"), num: z.number() }),
    ]);
    const result = zodToJsonSchema(schema);

    expect(result).toHaveProperty("oneOf");
    const oneOf = (result as { oneOf: unknown[] }).oneOf;
    expect(oneOf).toHaveLength(2);
  });

  it("converts nested objects", () => {
    const schema = z.object({
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
    });
    const result = zodToJsonSchema(schema);

    const props = (result as { properties: Record<string, unknown> }).properties;
    expect(props.position).toEqual({
      type: "object",
      properties: {
        x: { type: "number", description: undefined },
        y: { type: "number", description: undefined },
      },
      required: ["x", "y"],
    });
  });

  it("handles empty object (no required)", () => {
    const schema = z.object({});
    const result = zodToJsonSchema(schema);

    expect(result).toEqual({
      type: "object",
      properties: {},
    });
  });

  it("falls back to object for unknown types", () => {
    // Using z.any() as an example of an unhandled type
    const schema = z.any();
    const result = zodToJsonSchema(schema);
    expect(result).toEqual({ type: "object" });
  });
});

describe("isOptional", () => {
  it("returns true for ZodOptional", () => {
    expect(isOptional(z.string().optional())).toBe(true);
  });

  it("returns true for ZodDefault", () => {
    expect(isOptional(z.string().default("test"))).toBe(true);
  });

  it("returns false for required types", () => {
    expect(isOptional(z.string())).toBe(false);
    expect(isOptional(z.number())).toBe(false);
    expect(isOptional(z.boolean())).toBe(false);
  });
});
