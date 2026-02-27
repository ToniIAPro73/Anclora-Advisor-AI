import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/features/ChatInterface";
import { getCurrentUserFromCookies } from "@/lib/auth/session";

export default async function DashboardChatPage() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <article className="advisor-card shrink-0 p-4">
        <h1 className="advisor-heading text-3xl text-[#162944]">Workspace Conversacional</h1>
        <p className="mt-2 text-sm text-[#3a4f67]">
          Consulta normativa y recibe respuesta con trazabilidad de fuentes y alertas de riesgo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="advisor-chip">Fuentes desplegables</span>
          <span className="advisor-chip">Alertas integradas</span>
          <span className="advisor-chip">Contrato estable `/api/chat`</span>
        </div>
      </article>
      <ChatInterface userId={user.id} conversationId={`dashboard-${user.id}`} />
    </section>
  );
}
