export class BridgeError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class ValidationError extends BridgeError {
  constructor(message) {
    super("VALIDATION", message, false);
    this.name = "ValidationError";
  }
}

export class OllamaTimeoutError extends BridgeError {
  constructor(message = "Model request timed out") {
    super("TIMEOUT", message, true);
    this.name = "OllamaTimeoutError";
  }
}

export class OllamaUnavailableError extends BridgeError {
  constructor(message = "Ollama is unavailable") {
    super("UNAVAILABLE", message, true);
    this.name = "OllamaUnavailableError";
  }
}

export function normalizeError(err) {
  if (err instanceof BridgeError) {
    return err;
  }

  return new BridgeError("INTERNAL", "Unexpected bridge error", false);
}
