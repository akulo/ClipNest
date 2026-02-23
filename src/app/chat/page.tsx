"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, previousResponseId }),
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        const chunk = decoder.decode(value, { stream: !done });
        accumulated += chunk;

        if (done) {
          // Extract and strip the response ID marker
          const idMatch = accumulated.match(/\n?\[CLIPNEST_ID:([\w-]+)\]$/);
          if (idMatch) {
            setPreviousResponseId(idMatch[1]);
            accumulated = accumulated.replace(/\n?\[CLIPNEST_ID:[\w-]+\]$/, "");
          }
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: accumulated };
            return updated;
          });
          break;
        }

        // Stream chunks to UI (may briefly show marker — cleaned up on done)
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-lg font-semibold">ClipNest</h1>
        <p className="text-sm text-gray-400">Ask anything about video content</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-xl mb-2">What are you looking for?</p>
            <p className="text-sm">
              Try: &quot;Find videos about React hooks&quot; or &quot;Best cooking tutorials in NYC&quot;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-2xl rounded-2xl px-4 py-3 text-sm bg-blue-600 text-white">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-2xl w-full rounded-2xl px-5 py-4 text-sm bg-gray-800 text-gray-100 prose prose-invert prose-sm max-w-none">
                {msg.content === "" && loading ? (
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse" />
                ) : (
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          {children}
                        </a>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-white font-semibold text-base mt-4 mb-2">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-gray-200 font-medium mt-3 mb-1">
                          {children}
                        </h3>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-white font-semibold">{children}</strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 text-gray-200">
                          {children}
                        </ul>
                      ),
                      hr: () => <hr className="border-gray-600 my-3" />,
                      p: ({ children }) => (
                        <p className="text-gray-200 leading-relaxed mb-2">{children}</p>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="border-t border-gray-800 px-4 py-4 flex gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about videos..."
          disabled={loading}
          autoComplete="off"
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
