import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, FileSearch } from "lucide-react";
import type { ChatMessage, Conversation, DocumentItem, MessageSource } from "@/types/api";
import { chatApi, streamMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TokenCounter } from "@/components/TokenCounter";
import { Skeleton } from "@/components/ui/primitives";

const FRAGMENT_RE = /(\[fragmento \d+\])/g;

function AnswerText({ text, sources }: { text: string; sources: MessageSource[] }) {
  const parts = text.split(FRAGMENT_RE);
  return (
    <p className="text-sm leading-relaxed text-ink-100 whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/\[fragmento (\d+)\]/);
        if (!match) return <span key={i}>{part}</span>;
        const idx = Number(match[1]) - 1;
        const source = sources[idx];
        return (
          <span
            key={i}
            title={source ? source.preview : undefined}
            className="mx-0.5 inline-flex items-center rounded-md bg-accent-purple/15 border border-accent-purple/30 px-1.5 py-0.5 text-xs font-mono text-accent-purple cursor-help"
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}

export function ChatWindow({ document }: { document: DocumentItem | null }) {
  const { push } = useToast();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document) {
      setConversation(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingConvo(true);
    (async () => {
      try {
        const { conversations } = await chatApi.listConversations(document.id);
        let convo = conversations[0];
        if (!convo) {
          const created = await chatApi.createConversation(document.id);
          convo = created.conversation;
        }
        const full = await chatApi.getConversation(convo.id);
        if (cancelled) return;
        setConversation(full.conversation);
        setMessages(full.conversation.messages ?? []);
      } catch (err) {
        push(err instanceof Error ? err.message : "No se pudo abrir la conversación", "error");
      } finally {
        if (!cancelled) setLoadingConvo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document, push]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !conversation || sending) return;

    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content, sources: [], prompt_tokens: 0, completion_tokens: 0 },
      { role: "assistant", content: "", sources: [], prompt_tokens: 0, completion_tokens: 0, pending: true },
    ]);

    let liveSources: MessageSource[] = [];

    await streamMessage(conversation.id, content, {
      onSources: (sources) => {
        liveSources = sources;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], sources };
          return copy;
        });
      },
      onToken: (piece) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + piece };
          return copy;
        });
      },
      onDone: (usage) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = {
            ...last,
            pending: false,
            sources: liveSources,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
          };
          return copy;
        });
        setSending(false);
      },
      onError: (message) => {
        push(message, "error");
        setSending(false);
      },
    });
  };

  if (!document) {
    return (
      <div className="card flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <FileSearch size={32} className="text-ink-700" />
        <p className="text-ink-500 text-sm max-w-xs">
          Selecciona un documento listo en el panel de la izquierda para empezar a
          preguntarle en lenguaje natural.
        </p>
      </div>
    );
  }

  return (
    <div className="card flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-base-700 flex items-center gap-2">
        <Sparkles size={16} className="text-accent-teal" />
        <div>
          <p className="text-sm font-medium text-ink-100">{document.filename}</p>
          <p className="text-xs text-ink-700">{document.chunk_count} fragmentos indexados</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loadingConvo ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-16 w-3/4 ml-auto" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink-700 text-center py-8">
            Hazle una pregunta a "{document.filename}". Las respuestas citan los
            fragmentos exactos usados.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl2 px-4 py-3 ${
                  m.role === "user"
                    ? "bg-accent-purple/15 border border-accent-purple/30"
                    : "bg-base-900 border border-base-700"
                }`}
              >
                {m.role === "assistant" ? (
                  <AnswerText text={m.content || (m.pending ? "…" : "")} sources={m.sources} />
                ) : (
                  <p className="text-sm text-ink-100 whitespace-pre-wrap">{m.content}</p>
                )}
                {m.role === "assistant" && !m.pending && m.content && (
                  <div className="mt-2.5 pt-2.5 border-t border-base-700/70">
                    <TokenCounter
                      promptTokens={m.prompt_tokens}
                      completionTokens={m.completion_tokens}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 py-4 border-t border-base-700">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pregúntale algo a este documento…"
            rows={1}
            className="input resize-none max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="btn-primary h-[42px] w-[42px] p-0 shrink-0"
            aria-label="Enviar mensaje"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
