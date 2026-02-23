import { z } from "zod";

// ─── Shared Types ────────────────────────────────────────────────────────────

export const NodeId = z
  .string()
  .min(1)
  .max(100)
  .describe("Figma node ID, e.g. '123:456'");

export const RGBAColor = z
  .object({
    r: z.number().min(0).max(1).describe("Red channel 0-1"),
    g: z.number().min(0).max(1).describe("Green channel 0-1"),
    b: z.number().min(0).max(1).describe("Blue channel 0-1"),
    a: z.number().min(0).max(1).default(1).describe("Alpha channel 0-1"),
  })
  .strict();

export const SolidFill = z
  .object({
    type: z.literal("SOLID"),
    color: RGBAColor,
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

export const GradientStop = z
  .object({
    position: z.number().min(0).max(1),
    color: RGBAColor,
  })
  .strict();

export const GradientFill = z
  .object({
    type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL"]),
    gradientStops: z.array(GradientStop).min(2).max(20),
  })
  .strict();

export const Fill = z.discriminatedUnion("type", [SolidFill, GradientFill]);

export const StrokeConfig = z
  .object({
    color: RGBAColor,
    weight: z.number().positive().default(1),
    align: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).default("INSIDE"),
  })
  .strict();

export const LineHeight = z.union([
  z
    .object({ unit: z.literal("PIXELS"), value: z.number().positive() })
    .strict(),
  z
    .object({ unit: z.literal("PERCENT"), value: z.number().positive() })
    .strict(),
  z.object({ unit: z.literal("AUTO") }).strict(),
]);

export const Typography = z
  .object({
    fontFamily: z.string().max(200).default("Inter"),
    fontStyle: z.string().max(100).default("Regular"),
    fontSize: z.number().positive().max(1000).default(16),
    textAlign: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).default("LEFT"),
    letterSpacing: z.number().min(-100).max(1000).default(0),
    lineHeight: LineHeight.default({ unit: "AUTO" }),
  })
  .strict();

export const Padding = z
  .object({
    top: z.number().min(0).max(10000).default(0),
    right: z.number().min(0).max(10000).default(0),
    bottom: z.number().min(0).max(10000).default(0),
    left: z.number().min(0).max(10000).default(0),
  })
  .strict();

export const AutoLayoutAlign = z.enum([
  "MIN",
  "CENTER",
  "MAX",
  "SPACE_BETWEEN",
]);
