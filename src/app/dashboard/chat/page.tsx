import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/features/ChatInterface";
import { getAccessTokenFromCookies, getCurrentUserFromCookies } from "@/lib/auth/session";
import type { ChatConversationRecord, ChatPersistedMessageRecord } from "@/lib/chat/contracts";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

interface DashboardChatPageProps {
  searchParams?: Promise<{ c?: string }>;
}

export default async function DashboardChatPage({ searchParams }: DashboardChatPageProps) {
  const user = await getCurrentUserFromCookies();
  const accessToken = await getAccessTokenFromCookies();
  if (!user || !accessToken) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const supabase = createUserScopedSupabaseClient(accessToken);

  const { data: conversationData } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  const conversations = (conversationData ?? []) as ChatConversationRecord[];
  const requestedConversationId = params.c;
  const activeConversation = conversations.find((item) => item.id === requestedConversationId) ?? conversations[0] ?? null;

  let messages: ChatPersistedMessageRecord[] = [];
  if (activeConversation) {
    const { data: messagesData } = await supabase
      .from("messages")
      .select("id, role, content, created_at, context_chunks, suggested_actions")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: true });

    messages = (messagesData ?? []) as ChatPersistedMessageRecord[];
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl" style={{ color: "var(--text-primary)" }}>Workspace Conversacional</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Consulta normativa y reanuda conversaciones persistidas con trazabilidad de fuentes y alertas de riesgo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="advisor-chip">Historial persistido</span>
          <span className="advisor-chip">Fuentes desplegables</span>
          <span className="advisor-chip">Alertas integradas</span>
        </div>
      </article>
      <ChatInterface
        userId={user.id}
        initialConversationId={activeConversation?.id ?? null}
        initialConversations={conversations}
        initialMessages={messages}
      />
    </section>
  );
}
