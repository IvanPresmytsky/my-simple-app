import {
  DEFAULT_NUM_CTX,
  DEFAULT_TEMPERATURE,
  OLLAMA_BASE_URL,
  RETRYABLE_HTTP_STATUSES,
} from "./constants.js";
import { BridgeError, OllamaTimeoutError, OllamaUnavailableError } from "./errors.js";

function isRetryableError(err) {
  if (err instanceof OllamaTimeoutError) return true;
  if (err instanceof OllamaUnavailableError) return true;
  if (err instanceof BridgeError && err.retryable) return true;
  return false;
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    return await fn();
  }
}

export function mapUsage(resp) {
  return {
    promptTokens: Number(resp.prompt_eval_count || 0),
    outputTokens: Number(resp.eval_count || 0),
  };
}

export async function generateWithOllama({
  model,
  prompt,
  temperature = DEFAULT_TEMPERATURE,
  numPredict,
  numCtx = DEFAULT_NUM_CTX,
  timeoutMs,
}) {
  return await withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: numPredict,
            num_ctx: numCtx,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (RETRYABLE_HTTP_STATUSES.has(res.status)) {
          throw new OllamaUnavailableError(`Ollama temporary failure: HTTP ${res.status}`);
        }

        throw new BridgeError("UNAVAILABLE", `Ollama request failed with HTTP ${res.status}`, false);
      }

      return await res.json();
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new OllamaTimeoutError();
      }

      if (err instanceof BridgeError) {
        throw err;
      }

      throw new OllamaUnavailableError("Cannot reach Ollama at 127.0.0.1:11434");
    } finally {
      clearTimeout(timeout);
    }
  });
}
