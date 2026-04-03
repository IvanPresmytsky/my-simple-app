export function makeSuccess({ tool, model, latencyMs, usage, output, warnings = [] }) {
  return {
    ok: true,
    tool,
    model,
    latencyMs,
    usage,
    output,
    warnings,
  };
}

export function makeError({ tool, code, message, retryable }) {
  return {
    ok: false,
    tool,
    code,
    message,
    retryable,
  };
}
