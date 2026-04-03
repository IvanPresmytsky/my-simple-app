import { z } from "zod";

import { MAX_NUM_PREDICT, MAX_TEMPERATURE } from "./constants.js";
import { ValidationError } from "./errors.js";

const modeSchema = z.enum(["fast", "quality"]);

export const askGemmaSchema = z
  .object({
    prompt: z.string().min(1),
    mode: modeSchema.optional(),
    temperature: z.number().min(0).max(MAX_TEMPERATURE).optional(),
    maxTokens: z.number().int().min(1).max(MAX_NUM_PREDICT).optional(),
  })
  .strict();

export const explainCodeSchema = z
  .object({
    code: z.string().min(1),
    language: z.string().min(1).optional(),
    question: z.string().min(1).optional(),
    mode: modeSchema.optional(),
  })
  .strict();

export const summarizeDiffSchema = z
  .object({
    diff: z.string().min(1),
    focus: z.enum(["risk", "overview", "tests"]).optional(),
    mode: modeSchema.optional(),
  })
  .strict();

export const draftTestsSchema = z
  .object({
    code: z.string().min(1),
    framework: z.string().min(1).optional(),
    target: z.enum(["unit", "integration"]).optional(),
    mode: modeSchema.optional(),
  })
  .strict();

export const toolSchemas = {
  ask_gemma: askGemmaSchema,
  explain_code: explainCodeSchema,
  summarize_diff: summarizeDiffSchema,
  draft_tests: draftTestsSchema,
};

export const toolInputSchemas = {
  ask_gemma: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
      prompt: { type: "string", minLength: 1 },
      mode: { type: "string", enum: ["fast", "quality"] },
      temperature: { type: "number", minimum: 0, maximum: MAX_TEMPERATURE },
      maxTokens: { type: "integer", minimum: 1, maximum: MAX_NUM_PREDICT },
    },
  },
  explain_code: {
    type: "object",
    additionalProperties: false,
    required: ["code"],
    properties: {
      code: { type: "string", minLength: 1 },
      language: { type: "string", minLength: 1 },
      question: { type: "string", minLength: 1 },
      mode: { type: "string", enum: ["fast", "quality"] },
    },
  },
  summarize_diff: {
    type: "object",
    additionalProperties: false,
    required: ["diff"],
    properties: {
      diff: { type: "string", minLength: 1 },
      focus: { type: "string", enum: ["risk", "overview", "tests"] },
      mode: { type: "string", enum: ["fast", "quality"] },
    },
  },
  draft_tests: {
    type: "object",
    additionalProperties: false,
    required: ["code"],
    properties: {
      code: { type: "string", minLength: 1 },
      framework: { type: "string", minLength: 1 },
      target: { type: "string", enum: ["unit", "integration"] },
      mode: { type: "string", enum: ["fast", "quality"] },
    },
  },
};

export function validateInput(toolName, payload) {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new ValidationError(`Unknown tool: ${toolName}`);
  }

  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new ValidationError(`Invalid input for ${toolName}: ${details}`);
  }

  return parsed.data;
}
