"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles } from "lucide-react";
import type { BoardData } from "@/lib/kanban";
import { sendChat, type ChatMessage } from "@/lib/api";

type AISidebarProps = {
  isOpen: boolean;
  boardId: number;
  onClose: () => void;
  onBoardUpdate: (board: BoardData) => void;
};

export const AISidebar = ({ isOpen, boardId, onClose, onBoardUpdate }: AISidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [boardId]);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages];
    const newMessages = [...history, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendChat(text, history, boardId);
      const assistantMsg: ChatMessage = { role: "assistant", content: response.message };
      setMessages([...newMessages, assistantMsg]);
      if (response.board_update) {
        onBoardUpdate(response.board_update);
      }
    } catch {
      setError("Failed to get a response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        data-testid="ai-sidebar"
        aria-label="AI assistant sidebar"
        className={`fixed right-0 top-0 z-30 flex h-[100dvh] w-full sm:w-[360px] flex-col border-l border-[var(--stroke)] bg-[var(--surface-strong)] shadow-[var(--shadow)] transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary-blue)]">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                AI Assistant
              </p>
              <h2 className="text-sm font-semibold text-[var(--navy-dark)]">
                Ask me anything
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI sidebar"
            className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && !loading && (
            <p className="text-center text-xs text-[var(--gray-text)] mt-8 leading-6">
              Ask me to help manage your board — move cards, add tasks, or just chat.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  msg.role === "user"
                    ? "bg-[var(--primary-blue)] text-white"
                    : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--gray-text)]">
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <p className="text-center text-xs text-red-500">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--stroke)] p-4">
          <div className="flex items-end gap-2">
            <textarea
              aria-label="Chat input"
              className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5 text-base sm:text-sm text-[var(--navy-dark)] placeholder:text-[var(--gray-text)] focus:border-[var(--primary-blue)] focus:outline-none disabled:opacity-50"
              placeholder="Type a message…"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="flex h-[68px] w-10 items-center justify-center rounded-xl bg-[var(--primary-blue)] text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
