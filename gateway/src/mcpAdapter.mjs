import { ValidationError } from "../../mcp/src/errors.js";
import { validateInput, toolInputSchemas } from "../../mcp/src/schemas.js";
import { handleAskGemma, handleExplainCode } from "../../mcp/src/handlers.js";

export const ALLOWED_TOOLS = ["ask_gemma", "explain_code"];

const handlers = {
  ask_gemma: handleAskGemma,
  explain_code: handleExplainCode,
};

export function listAllowedTools() {
  return ALLOWED_TOOLS.map((name) => ({
    name,
    inputSchema: toolInputSchemas[name],
  }));
}

export async function executeTool(tool, args) {
  if (!ALLOWED_TOOLS.includes(tool)) {
    throw new ValidationError(`Tool is not enabled in web client v1: ${tool}`);
  }

  const input = validateInput(tool, args);
  const handler = handlers[tool];
  return await handler(input);
}
