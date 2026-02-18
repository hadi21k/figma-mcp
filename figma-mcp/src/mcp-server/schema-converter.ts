import { z } from "zod";

/**
 * Converts a Zod schema to a JSON Schema object for MCP tool registration.
 * Handles the most common Zod types used in our tool definitions.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!isOptional(value)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: "string", description: schema.description };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: "number", description: schema.description };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(schema.element),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }

  if (schema instanceof z.ZodLiteral) {
    return { type: "string", const: schema.value };
  }

  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    const options = schema.options as z.ZodType[];
    return { oneOf: options.map((o: z.ZodType) => zodToJsonSchema(o)) };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema.removeDefault());
    return { ...inner, default: schema._def.defaultValue() };
  }

  return { type: "object" };
}

export function isOptional(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodOptional) return true;
  if (schema instanceof z.ZodDefault) return true;
  return false;
}
