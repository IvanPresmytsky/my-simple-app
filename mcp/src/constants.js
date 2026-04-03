export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

export const MODEL_FAST = process.env.MODEL_FAST || "gemma4:e4b";
export const MODEL_QUALITY = process.env.MODEL_QUALITY || "gemma4:31b";

export const DEFAULT_MODE = "fast";
export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_NUM_PREDICT = 512;
export const DEFAULT_NUM_CTX = 32768;

export const MAX_INPUT_CHARS = 120000;
export const MAX_NUM_PREDICT = 1024;
export const MAX_TEMPERATURE = 2;

export const TIMEOUT_FAST_MS = 45_000;
export const TIMEOUT_QUALITY_MS = 90_000;

export const RETRYABLE_HTTP_STATUSES = new Set([429, 503]);

export function resolveModeAndModel(mode = DEFAULT_MODE) {
  if (mode === "quality") {
    return { mode: "quality", model: MODEL_QUALITY, timeoutMs: TIMEOUT_QUALITY_MS };
  }

  return { mode: "fast", model: MODEL_FAST, timeoutMs: TIMEOUT_FAST_MS };
}

export function resolveNumPredict(maxTokens) {
  if (!Number.isInteger(maxTokens)) return DEFAULT_NUM_PREDICT;
  if (maxTokens < 1) return 1;
  if (maxTokens > MAX_NUM_PREDICT) return MAX_NUM_PREDICT;
  return maxTokens;
}
