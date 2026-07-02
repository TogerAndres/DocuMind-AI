import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, LogOut, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { DocumentItem } from "@/types/api";
import { documentsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { DocumentPanel } from "@/components/DocumentPanel";
import { ChatWindow } from "@/components/ChatWindow";

export function Dashboard() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { documents } = await documentsApi.list();
      setDocuments(documents);
      setSelected((prev) => {
        if (!prev) return prev;
        return documents.find((d) => d.id === prev.id) ?? null;
      });
    } catch (err) {
      push(err instanceof Error ? err.message : "No se pudieron cargar los documentos", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Light polling while any document is still processing.
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [documents, refresh]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-base-700 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit size={22} className="text-accent-teal" />
          <span className="font-display font-semibold">DocuMind</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === "admin" && (
            <Link to="/admin" className="btn-ghost text-xs gap-1.5">
              <ShieldCheck size={14} /> Admin
            </Link>
          )}
          <span className="text-sm text-ink-500 hidden sm:inline">{user?.name}</span>
          <button onClick={logout} className="btn-ghost text-xs gap-1.5">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 p-4 lg:p-6 min-h-0">
        <aside className="card p-4 lg:h-[calc(100vh-6rem)] flex flex-col">
          <DocumentPanel
            documents={documents}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onChanged={refresh}
          />
        </aside>
        <section className="flex lg:h-[calc(100vh-6rem)]">
          <ChatWindow document={selected} />
        </section>
      </main>
    </div>
  );
}
