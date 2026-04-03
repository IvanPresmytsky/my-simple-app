import { useEffect, useRef, useState } from "react";

const OLLAMA_BASE = "/api/ollama";
const DEFAULT_MODEL = "gemma4:e4b";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("512");
  const [selectedDebug, setSelectedDebug] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input, timestamp: new Date().toISOString() };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(OLLAMA_BASE + "/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: input,
          stream: false,
          options: {
            temperature: Number(temperature),
            num_predict: Number(maxTokens),
            num_ctx: 32768,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();
      const assistantMessage = {
        role: "assistant",
        content: data.response || "",
        debug: {
          model: data.model,
          done: data.done,
          prompt_eval_count: data.prompt_eval_count,
          eval_count: data.eval_count,
          total_duration: data.total_duration,
          load_duration: data.load_duration,
        },
        timestamp: new Date().toISOString(),
      };

      setMessages((m) => [...m, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        role: "error",
        content: "Error: " + err.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-main">
        <div className="chat-header">
          <h1>Gemma Local Chat</h1>
          <div className="header-controls">
            <label>Model:</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading}>
              <option value="gemma4:e4b">gemma4:e4b (fast)</option>
              <option value="gemma4:31b">gemma4:31b (quality)</option>
            </select>

            <label>Temperature:</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              disabled={loading}
            />

            <label>Max Tokens:</label>
            <input
              type="number"
              min="1"
              max="1024"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Start a conversation with Gemma</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={"message message-" + msg.role}
                onClick={() => setSelectedDebug(msg.debug ? idx : null)}
              >
                <div className="message-role">{msg.role}</div>
                <div className="message-content">{msg.content}</div>
                {msg.debug && <div className="debug-indicator">●</div>}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-form" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type your message..."
            rows={3}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? "Typing..." : "Send"}
          </button>
        </form>
      </div>

      {selectedDebug !== null && messages[selectedDebug]?.debug ? (
        <div className="debug-panel">
          <div className="debug-header">
            <h3>Debug Info</h3>
            <button onClick={() => setSelectedDebug(null)}>x</button>
          </div>
          <pre>{JSON.stringify(messages[selectedDebug].debug, null, 2)}</pre>
        </div>
      ) : (
        <div className="debug-panel-empty">
          <p>Click on a model response to see debug info</p>
        </div>
      )}
    </div>
  );
}
