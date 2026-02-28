import { redirect } from "next/navigation";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

type RecentDocument = {
  id: string;
  title: string;
  category: string | null;
  created_at: string;
  doc_metadata?: {
    notebook_id?: string | null;
    jurisdiction?: string | null;
    topic?: string | null;
  } | null;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardAdminPage() {
  const appUser = await getCurrentAppUserFromCookies();

  if (!appUser || !appUser.isActive || !isAdminRole(appUser.role)) {
    redirect("/dashboard/chat");
  }

  const supabase = createServiceSupabaseClient();

  const [{ count: documentCount }, { count: chunkCount }, { data: recentDocuments, error: recentError }] =
    await Promise.all([
      supabase.from("rag_documents").select("id", { count: "exact", head: true }),
      supabase.from("rag_chunks").select("id", { count: "exact", head: true }),
      supabase
        .from("rag_documents")
        .select("id, title, category, created_at, doc_metadata")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const documents = ((recentDocuments ?? []) as RecentDocument[]).map((document) => ({
    ...document,
    notebookId: document.doc_metadata?.notebook_id ?? "sin notebook",
    jurisdiction: document.doc_metadata?.jurisdiction ?? "sin jurisdiccion",
    topic: document.doc_metadata?.topic ?? "sin topic",
  }));

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-auto pr-1">
      <article className="advisor-card shrink-0 p-6">
        <h1 className="advisor-heading text-3xl text-[#162944]">Panel Admin</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#3a4f67]">
          Superficie reservada para administracion del conocimiento, validacion de metadatos y futuras rutas de
          ingesta segura.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Rol efectivo</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">{appUser.role}</p>
            <p className="mt-1 text-sm text-[#3a4f67]">{appUser.email}</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Documentos RAG</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">{documentCount ?? 0}</p>
            <p className="mt-1 text-sm text-[#3a4f67]">Inventario actual disponible para retrieval.</p>
          </div>
          <div className="advisor-card-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Chunks indexados</p>
            <p className="mt-1 text-lg font-semibold text-[#162944]">{chunkCount ?? 0}</p>
            <p className="mt-1 text-sm text-[#3a4f67]">Base operativa para embeddings y hybrid search.</p>
          </div>
        </div>
      </article>

      <article className="advisor-card min-h-0 flex-1 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Ultimos documentos</p>
            <p className="mt-1 text-sm text-[#3a4f67]">
              Verificacion rapida de metadata util para notebook scope, jurisdiccion y topic.
            </p>
          </div>
          <span className="advisor-chip">RBAC activo</span>
        </div>

        {recentError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No se pudo cargar el inventario RAG: {recentError.message}
          </div>
        )}

        {!recentError && documents.length === 0 && (
          <div className="mt-4 rounded-xl border border-[#d2dceb] bg-[#f6f9ff] p-4 text-sm text-[#3a4f67]">
            No hay documentos RAG disponibles.
          </div>
        )}

        {!recentError && documents.length > 0 && (
          <div className="mt-4 space-y-3">
            {documents.map((document) => (
              <div key={document.id} className="advisor-card-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#162944]">{document.title}</p>
                    <p className="mt-1 text-sm text-[#3a4f67]">
                      categoria: {document.category ?? "sin categoria"} | topic: {document.topic}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#1c2b3c]">{formatDateTime(document.created_at)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#d2dceb] bg-white px-2 py-0.5 text-xs font-semibold text-[#1c2b3c]">
                    notebook: {document.notebookId}
                  </span>
                  <span className="rounded-full border border-[#d2dceb] bg-white px-2 py-0.5 text-xs font-semibold text-[#1c2b3c]">
                    jurisdiccion: {document.jurisdiction}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
