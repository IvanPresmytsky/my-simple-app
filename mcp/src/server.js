import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { makeError } from "./envelope.js";
import {
  handleAskGemma,
  handleDraftTests,
  handleExplainCode,
  handleSummarizeDiff,
} from "./handlers.js";
import { toolInputSchemas, validateInput } from "./schemas.js";

function listTools() {
  return [
    {
      name: "ask_gemma",
      description: "General purpose local query to Gemma via Ollama",
      inputSchema: toolInputSchemas.ask_gemma,
    },
    {
      name: "explain_code",
      description: "Explain a code snippet and potential issues",
      inputSchema: toolInputSchemas.explain_code,
    },
    {
      name: "summarize_diff",
      description: "Summarize a git diff with focus on risks or tests",
      inputSchema: toolInputSchemas.summarize_diff,
    },
    {
      name: "draft_tests",
      description: "Generate test ideas from code",
      inputSchema: toolInputSchemas.draft_tests,
    },
  ];
}

async function callTool(name, args) {
  const input = validateInput(name, args);

  switch (name) {
    case "ask_gemma":
      return await handleAskGemma(input);
    case "explain_code":
      return await handleExplainCode(input);
    case "summarize_diff":
      return await handleSummarizeDiff(input);
    case "draft_tests":
      return await handleDraftTests(input);
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

function toResultContent(envelope, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    isError,
  };
}

const server = new Server(
  {
    name: "gemma-mcp-bridge",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: listTools() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params?.name;
  const args = request.params?.arguments || {};

  try {
    const envelope = await callTool(name, args);
    if (!envelope.ok) {
      return toResultContent(envelope, true);
    }
    return toResultContent(envelope, false);
  } catch (err) {
    const envelope = makeError({
      tool: String(name || "unknown"),
      code: "INTERNAL",
      message: err instanceof Error ? err.message : "Unhandled server error",
      retryable: false,
    });
    return toResultContent(envelope, true);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP bridge:", err);
  process.exit(1);
});
