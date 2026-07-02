import { useCallback, useRef, useState } from "react";
import { FileText, RotateCw, Trash2, UploadCloud, MessageSquare } from "lucide-react";
import type { DocumentItem } from "@/types/api";
import { documentsApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge, Skeleton } from "@/components/ui/primitives";

interface DocumentPanelProps {
  documents: DocumentItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (doc: DocumentItem) => void;
  onChanged: () => void;
}

const ACCEPTED = ".pdf,.md,.markdown,.txt";

export function DocumentPanel({
  documents,
  loading,
  selectedId,
  onSelect,
  onChanged,
}: DocumentPanelProps) {
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setUploading(true);
      try {
        await documentsApi.upload(file);
        push(`"${file.name}" se subió y procesó correctamente.`, "success");
        onChanged();
      } catch (err) {
        push(err instanceof Error ? err.message : "Error al subir el documento", "error");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChanged, push]
  );

  const handleDelete = async (doc: DocumentItem) => {
    setBusyId(doc.id);
    try {
      await documentsApi.remove(doc.id);
      push(`"${doc.filename}" fue eliminado.`, "info");
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "No se pudo eliminar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReprocess = async (doc: DocumentItem) => {
    setBusyId(doc.id);
    try {
      await documentsApi.reprocess(doc.id);
      push(`"${doc.filename}" fue re-procesado.`, "success");
      onChanged();
    } catch (err) {
      push(err instanceof Error ? err.message : "No se pudo re-procesar", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="label mb-2">Base de conocimiento</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`card cursor-pointer border-dashed px-4 py-6 text-center transition-colors ${
            dragOver ? "border-accent-teal bg-accent-teal/5" : "hover:border-accent-purple/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <UploadCloud
            size={22}
            className={`mx-auto mb-2 ${uploading ? "animate-bounce text-accent-teal" : "text-ink-500"}`}
          />
          <p className="text-sm text-ink-300">
            {uploading ? "Procesando documento…" : "Arrastra un PDF, Markdown o TXT"}
          </p>
          <p className="text-xs text-ink-700 mt-1">o haz clic para elegir un archivo</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-ink-700 text-center py-8">
            Todavía no hay documentos. Sube el primero para empezar a preguntar.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                onClick={() => doc.status === "ready" && onSelect(doc)}
                className={`card p-3 flex items-start gap-3 transition-colors ${
                  doc.status === "ready" ? "cursor-pointer hover:border-accent-teal/50" : "opacity-80"
                } ${selectedId === doc.id ? "border-accent-teal/70 shadow-glow" : ""}`}
              >
                <FileText size={18} className="text-accent-purple mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={doc.status} />
                    <span className="text-xs text-ink-700">
                      {doc.chunk_count} fragmentos
                      {doc.page_count ? ` · ${doc.page_count} pág.` : ""}
                    </span>
                  </div>
                  {doc.status === "failed" && doc.error_message && (
                    <p className="text-xs text-status-failed mt-1">{doc.error_message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {doc.status === "ready" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(doc);
                      }}
                      className="btn-ghost p-1.5"
                      title="Abrir chat"
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReprocess(doc);
                    }}
                    disabled={busyId === doc.id}
                    className="btn-ghost p-1.5"
                    title="Re-procesar"
                  >
                    <RotateCw size={14} className={busyId === doc.id ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                    disabled={busyId === doc.id}
                    className="btn-ghost p-1.5 hover:text-status-failed"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
