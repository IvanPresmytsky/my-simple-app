import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";

import { normalizeError } from "../../mcp/src/errors.js";
import { executeTool, listAllowedTools } from "./mcpAdapter.mjs";

const PORT = Number(process.env.GATEWAY_PORT || 8787);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const queue = [];
let activeTask = null;

function safeSend(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function normalizeEnvelopeError(err, tool = "unknown") {
  const normalized = normalizeError(err);
  return {
    ok: false,
    tool,
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
  };
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function checkOllama() {
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!resp.ok) return { ok: false, status: resp.status };
    const data = await resp.json();
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch {
    return { ok: false, status: 0 };
  }
}

function processQueue() {
  if (activeTask || queue.length === 0) return;

  const task = queue.shift();
  activeTask = task;

  safeSend(task.ws, {
    type: "status",
    requestId: task.requestId,
    state: "running",
  });

  executeTool(task.tool, task.args)
    .then((envelope) => {
      safeSend(task.ws, {
        type: "done",
        requestId: task.requestId,
        envelope,
      });
    })
    .catch((err) => {
      safeSend(task.ws, {
        type: "error",
        requestId: task.requestId,
        envelope: normalizeEnvelopeError(err, task.tool),
      });
    })
    .finally(() => {
      activeTask = null;
      processQueue();
    });
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { ok: false, message: "Bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    const ollama = await checkOllama();
    sendJson(res, 200, {
      ok: true,
      gateway: { status: "up", activeTask: Boolean(activeTask), queueSize: queue.length },
      ollama,
      tools: listAllowedTools().map((t) => t.name),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tools") {
    sendJson(res, 200, {
      ok: true,
      tools: listAllowedTools(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tools/call") {
    try {
      const body = await parseJsonBody(req);
      const tool = body.tool;
      const args = body.args || {};

      const envelope = await executeTool(tool, args);
      sendJson(res, 200, envelope);
    } catch (err) {
      const tool = req.headers["x-tool-name"] || "unknown";
      sendJson(res, 400, normalizeEnvelopeError(err, String(tool)));
    }
    return;
  }

  sendJson(res, 404, { ok: false, message: "Not found" });
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  safeSend(ws, { type: "ready" });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString("utf8"));
    } catch {
      safeSend(ws, { type: "error", envelope: normalizeEnvelopeError(new Error("Invalid JSON")) });
      return;
    }

    if (message.type !== "run") {
      safeSend(ws, { type: "error", envelope: normalizeEnvelopeError(new Error("Unsupported message type")) });
      return;
    }

    const task = {
      ws,
      requestId: String(message.requestId || crypto.randomUUID()),
      tool: String(message.tool || ""),
      args: message.args || {},
    };

    queue.push(task);

    safeSend(ws, {
      type: "status",
      requestId: task.requestId,
      state: "queued",
      position: queue.length,
    });

    processQueue();
  });
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

function shutdown() {
  wss.clients.forEach((client) => {
    safeSend(client, { type: "status", state: "shutdown" });
    client.close();
  });

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});
