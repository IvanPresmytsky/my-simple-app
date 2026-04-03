import {
  DEFAULT_TEMPERATURE,
  MAX_INPUT_CHARS,
  resolveModeAndModel,
  resolveNumPredict,
} from "./constants.js";
import { makeError, makeSuccess } from "./envelope.js";
import { normalizeError, ValidationError } from "./errors.js";
import { mapUsage, generateWithOllama } from "./ollamaClient.js";
import {
  buildAskPrompt,
  buildDraftTestsPrompt,
  buildExplainPrompt,
  buildSummarizeDiffPrompt,
} from "./prompts.js";

function enforceInputLimit(value, fieldName) {
  if (typeof value !== "string") return;
  if (value.length > MAX_INPUT_CHARS) {
    throw new ValidationError(`${fieldName} exceeds ${MAX_INPUT_CHARS} chars`);
  }
}

async function runModel({ toolName, mode, prompt, maxTokens, temperature }) {
  const started = Date.now();
  const route = resolveModeAndModel(mode);
  const numPredict = resolveNumPredict(maxTokens);

  try {
    const response = await generateWithOllama({
      model: route.model,
      prompt,
      temperature: typeof temperature === "number" ? temperature : DEFAULT_TEMPERATURE,
      numPredict,
      timeoutMs: route.timeoutMs,
    });

    return makeSuccess({
      tool: toolName,
      model: route.model,
      latencyMs: Date.now() - started,
      usage: mapUsage(response),
      output: String(response.response || ""),
      warnings: [],
    });
  } catch (err) {
    const normalized = normalizeError(err);

    if (mode === "quality" && (normalized.code === "TIMEOUT" || normalized.code === "UNAVAILABLE")) {
      const fallbackRoute = resolveModeAndModel("fast");
      const fallbackResp = await generateWithOllama({
        model: fallbackRoute.model,
        prompt,
        temperature: typeof temperature === "number" ? temperature : DEFAULT_TEMPERATURE,
        numPredict,
        timeoutMs: fallbackRoute.timeoutMs,
      });

      return makeSuccess({
        tool: toolName,
        model: fallbackRoute.model,
        latencyMs: Date.now() - started,
        usage: mapUsage(fallbackResp),
        output: String(fallbackResp.response || ""),
        warnings: ["quality model fallback to fast model"],
      });
    }

    return makeError({
      tool: toolName,
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
    });
  }
}

export async function handleAskGemma(input) {
  enforceInputLimit(input.prompt, "prompt");
  return await runModel({
    toolName: "ask_gemma",
    mode: input.mode,
    prompt: buildAskPrompt(input),
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });
}

export async function handleExplainCode(input) {
  enforceInputLimit(input.code, "code");
  if (input.question) enforceInputLimit(input.question, "question");

  return await runModel({
    toolName: "explain_code",
    mode: input.mode,
    prompt: buildExplainPrompt(input),
  });
}

export async function handleSummarizeDiff(input) {
  enforceInputLimit(input.diff, "diff");

  return await runModel({
    toolName: "summarize_diff",
    mode: input.mode,
    prompt: buildSummarizeDiffPrompt(input),
  });
}

export async function handleDraftTests(input) {
  enforceInputLimit(input.code, "code");

  return await runModel({
    toolName: "draft_tests",
    mode: input.mode,
    prompt: buildDraftTestsPrompt(input),
  });
}
