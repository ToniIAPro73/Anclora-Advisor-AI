import { redirect } from "next/navigation";
import { AdminKnowledgeWorkspace, type AdminDocumentRecord } from "@/components/features/AdminKnowledgeWorkspace";
import { getCurrentAppUserFromCookies } from "@/lib/auth/app-user";
import { isAdminRole } from "@/lib/auth/roles";
import { createServiceSupabaseClient } from "@/lib/supabase/server-admin";

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
        .limit(12),
    ]);

  return (
    <section className="flex h-full min-h-0 overflow-hidden">
      <div className="min-h-0 flex-1">
        {recentError ? (
          <div className="advisor-card p-6 text-sm text-red-700">
            No se pudo cargar el inventario RAG inicial: {recentError.message}
          </div>
        ) : (
          <AdminKnowledgeWorkspace
            initialDocuments={(recentDocuments ?? []) as AdminDocumentRecord[]}
            initialDocumentCount={documentCount ?? 0}
            initialChunkCount={chunkCount ?? 0}
          />
        )}
      </div>
    </section>
  );
}
