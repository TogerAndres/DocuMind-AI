import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, FileStack, MessagesSquare, Users } from "lucide-react";
import type { AdminMetrics, DocumentItem } from "@/types/api";
import { adminApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge, Skeleton } from "@/components/ui/primitives";

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-500 text-xs mb-2">
        {icon}
        {label}
      </div>
      <p className="font-display text-2xl font-semibold text-ink-100">{value}</p>
      {sub && <p className="text-xs text-ink-700 mt-1">{sub}</p>}
    </div>
  );
}

export function Admin() {
  const { push } = useToast();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, d] = await Promise.all([adminApi.metrics(), adminApi.allDocuments()]);
        setMetrics(m);
        setDocuments(d.documents);
      } catch (err) {
        push(err instanceof Error ? err.message : "No se pudo cargar el panel admin", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [push]);

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="btn-ghost text-xs gap-1.5 mb-4 -ml-2">
          <ArrowLeft size={14} /> Volver
        </Link>
        <h1 className="font-display text-2xl font-semibold mb-1">Panel de administración</h1>
        <p className="text-sm text-ink-500 mb-6">
          Métricas globales de la base de conocimiento y control de costos.
        </p>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <MetricCard
              icon={<FileStack size={14} />}
              label="Documentos"
              value={metrics.documents.total}
              sub={`${metrics.documents.ready} listos · ${metrics.documents.failed} fallidos`}
            />
            <MetricCard
              icon={<Users size={14} />}
              label="Usuarios"
              value={metrics.users}
            />
            <MetricCard
              icon={<MessagesSquare size={14} />}
              label="Conversaciones"
              value={metrics.conversations}
              sub={`${metrics.messages} mensajes`}
            />
            <MetricCard
              icon={<Coins size={14} />}
              label="Tokens totales"
              value={metrics.tokens.total.toLocaleString("es-CO")}
              sub={`${metrics.tokens.embedding_tokens.toLocaleString("es-CO")} ingesta · ${metrics.tokens.chat_tokens.toLocaleString("es-CO")} chat`}
            />
          </div>
        ) : null}

        <h2 className="label mb-3">Todos los documentos</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-700 text-left text-ink-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Archivo</th>
                <th className="px-4 py-3 font-medium">Dueño</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fragmentos</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-base-800 last:border-0">
                  <td className="px-4 py-3 text-ink-100">{doc.filename}</td>
                  <td className="px-4 py-3 text-ink-500">{doc.owner_email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-300 font-mono">{doc.chunk_count}</td>
                  <td className="px-4 py-3 text-ink-300 font-mono">{doc.tokens_used}</td>
                </tr>
              ))}
              {documents.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-700">
                    Todavía no hay documentos en el sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
