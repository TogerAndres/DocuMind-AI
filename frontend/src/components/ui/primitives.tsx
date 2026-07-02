import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import type { DocumentStatus } from "@/types/api";

// --- Badge ---
const STATUS_STYLES: Record<DocumentStatus, string> = {
  ready: "bg-accent-teal/15 text-accent-teal border-accent-teal/30",
  processing: "bg-status-processing/15 text-status-processing border-status-processing/30",
  failed: "bg-status-failed/15 text-status-failed border-status-failed/30",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  ready: "Listo",
  processing: "Procesando",
  failed: "Falló",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          status === "ready" && "bg-accent-teal",
          status === "processing" && "bg-status-processing animate-pulse",
          status === "failed" && "bg-status-failed"
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

// --- Skeleton ---
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-md bg-base-700/70", className)}
    />
  );
}

// --- Dialog ---
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-base-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="card relative w-full max-w-md p-6 shadow-glow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-ink-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
