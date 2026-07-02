import { Gauge } from "lucide-react";
import { clsx } from "clsx";

interface TokenCounterProps {
  promptTokens: number;
  completionTokens: number;
  maxContextTokens?: number;
  compact?: boolean;
}

/**
 * Visible token/cost meter — DocuMind's signature UI element, carried over
 * from AI Repo Analyzer's context-optimization panel. Shows exactly how
 * much of the context budget the last answer consumed, so the user can see
 * the RAG pipeline's cost in real time instead of it being a black box.
 */
export function TokenCounter({
  promptTokens,
  completionTokens,
  maxContextTokens = 6000,
  compact = false,
}: TokenCounterProps) {
  const total = promptTokens + completionTokens;
  const usagePct = Math.min(100, Math.round((promptTokens / maxContextTokens) * 100));

  const level =
    usagePct < 50 ? "ok" : usagePct < 80 ? "warn" : "hot";
  const barColor =
    level === "ok" ? "bg-accent-teal" : level === "warn" ? "bg-status-processing" : "bg-status-failed";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
        <Gauge size={12} className="text-accent-purple" />
        {total.toLocaleString("es-CO")} tok
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-900/60 px-3 py-2">
      <Gauge size={16} className="text-accent-purple shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-ink-500">Contexto usado</span>
          <span className="font-mono text-xs text-ink-300">
            {promptTokens.toLocaleString("es-CO")} / {maxContextTokens.toLocaleString("es-CO")}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-base-700 overflow-hidden">
          <div
            className={clsx("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-xs text-ink-100">
          +{completionTokens.toLocaleString("es-CO")}
        </div>
        <div className="text-[10px] text-ink-700">respuesta</div>
      </div>
    </div>
  );
}
