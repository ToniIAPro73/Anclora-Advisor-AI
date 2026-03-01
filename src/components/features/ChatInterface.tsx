// src/components/features/ChatInterface.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import type { ChatSuggestedAction } from "@/lib/chat/action-suggestions";
import type { ChatConversationRecord, ChatPersistedMessageRecord } from "@/lib/chat/contracts";
import MessageList from "./MessageList";

interface ChatInterfaceProps {
  userId: string;
  initialConversationId: string;
  initialConversations: ChatConversationRecord[];
  initialMessages: ChatPersistedMessageRecord[];
}

function mapPersistedMessage(message: ChatPersistedMessageRecord): ChatMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.created_at),
    suggestedActions: message.suggested_actions ?? [],
  };
}

function formatConversationLabel(conversation: ChatConversationRecord): string {
  const title = conversation.title?.trim();
  return title && title.length > 0 ? title : "Nueva conversacion";
}

function formatConversationDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId,
  initialConversationId,
  initialConversations,
  initialMessages,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversationRecord[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [inputQuery, setInputQuery] = useState("");
  const [actionStates, setActionStates] = useState<Record<string, { status: "idle" | "loading" | "success" | "error"; message: string | null }>>({});
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const mappedInitialMessages = useMemo(
    () => initialMessages.map(mapPersistedMessage).filter((message): message is ChatMessage => message !== null),
    [initialMessages]
  );

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;

  const { messages, loading, error, sendMessageStreaming, replaceMessages, appendAssistantMessage } = useChat(
    userId,
    activeConversationId,
    mappedInitialMessages
  );

  function getActionStateKey(messageId: string, actionId: string): string {
    return `${messageId}:${actionId}`;
  }

  function syncConversationInUrl(conversationId: string) {
    const next = new URLSearchParams(searchParams?.toString());
    next.set("c", conversationId);
    router.replace(`${pathname}?${next.toString()}`);
  }

  async function refreshConversations(preferredConversationId?: string) {
    const response = await fetch("/api/chat/conversations");
    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      conversations?: ChatConversationRecord[];
    };

    if (!response.ok || !result.success || !result.conversations) {
      throw new Error(result.error ?? "No se pudieron refrescar las conversaciones");
    }

    setConversations(result.conversations);
    if (preferredConversationId && result.conversations.some((item) => item.id === preferredConversationId)) {
      setActiveConversationId(preferredConversationId);
    }
  }

  async function loadConversation(conversationId: string) {
    if (!conversationId || conversationId === activeConversationId) {
      return;
    }

    setConversationLoading(true);
    setConversationError(null);
    setRenaming(false);
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`);
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        messages?: ChatPersistedMessageRecord[];
      };

      if (!response.ok || !result.success || !result.messages) {
        throw new Error(result.error ?? "No se pudo cargar la conversacion");
      }

      const nextMessages = result.messages
        .map(mapPersistedMessage)
        .filter((message): message is ChatMessage => message !== null);
      setActiveConversationId(conversationId);
      replaceMessages(nextMessages);
      syncConversationInUrl(conversationId);
    } catch (loadError) {
      setConversationError(loadError instanceof Error ? loadError.message : "Error al cargar la conversacion");
    } finally {
      setConversationLoading(false);
    }
  }

  async function handleNewConversation() {
    setConversationLoading(true);
    setConversationError(null);
    setRenaming(false);
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nueva conversacion" }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        conversation?: ChatConversationRecord;
      };

      if (!response.ok || !result.success || !result.conversation) {
        throw new Error(result.error ?? "No se pudo crear la conversacion");
      }

      setConversations((prev) => [result.conversation as ChatConversationRecord, ...prev]);
      setActiveConversationId(result.conversation.id);
      replaceMessages([]);
      setRenameValue(formatConversationLabel(result.conversation));
      syncConversationInUrl(result.conversation.id);
    } catch (createError) {
      setConversationError(createError instanceof Error ? createError.message : "Error al crear la conversacion");
    } finally {
      setConversationLoading(false);
    }
  }

  async function handleRenameConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation || !renameValue.trim()) {
      return;
    }

    setConversationLoading(true);
    setConversationError(null);
    try {
      const response = await fetch(`/api/chat/conversations/${activeConversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        conversation?: ChatConversationRecord;
      };

      if (!response.ok || !result.success || !result.conversation) {
        throw new Error(result.error ?? "No se pudo renombrar la conversacion");
      }

      setConversations((prev) =>
        prev.map((item) => (item.id === result.conversation?.id ? (result.conversation as ChatConversationRecord) : item))
      );
      setRenaming(false);
    } catch (renameError) {
      setConversationError(renameError instanceof Error ? renameError.message : "Error al renombrar la conversacion");
    } finally {
      setConversationLoading(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading || conversationLoading) return;

    try {
      await sendMessageStreaming(inputQuery);
      setInputQuery("");
      await refreshConversations(activeConversationId);
    } catch (sendError) {
      console.error("Send message error:", sendError);
    }
  };

  async function executeSuggestedAction(messageId: string, action: ChatSuggestedAction) {
    const stateKey = getActionStateKey(messageId, action.id);
    setActionStates((prev) => ({
      ...prev,
      [stateKey]: { status: "loading", message: "Creando..." },
    }));

    try {
      let response: Response;
      let successSummary = "";

      if (action.kind === "create_fiscal_alert") {
        response = await fetch("/api/fiscal-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        successSummary = "He creado una alerta fiscal vinculada a esta consulta.";
      } else if (action.kind === "create_labor_assessment") {
        response = await fetch("/api/labor-risk-assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        successSummary = "He creado una evaluacion laboral a partir de esta conversacion.";
      } else {
        response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        successSummary = "He creado un borrador de factura con los importes detectados.";
      }

      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "No se pudo ejecutar la accion sugerida");
      }

      setActionStates((prev) => ({
        ...prev,
        [stateKey]: { status: "success", message: "Accion creada correctamente." },
      }));
      appendAssistantMessage({
        content: `${successSummary} Puedes revisarla en el modulo correspondiente.`,
        suggestedActions: [],
        alerts: [],
        citations: [],
        contexts: [],
      });
    } catch (actionError) {
      setActionStates((prev) => ({
        ...prev,
        [stateKey]: {
          status: "error",
          message: actionError instanceof Error ? actionError.message : "Error al ejecutar la accion",
        },
      }));
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-5">
      <aside className="advisor-card flex min-h-0 flex-col overflow-hidden lg:col-span-2">
        <div className="shrink-0 border-b border-[#d2dceb] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl text-[#162944]">Conversaciones</h2>
              <p className="mt-1 text-sm text-[#3a4f67]">Historial persistido por usuario.</p>
            </div>
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={conversationLoading || loading}
              className="advisor-btn advisor-btn-primary px-4 py-2 text-sm"
            >
              Nueva
            </button>
          </div>
          {activeConversation && (
            <div className="mt-3 rounded-xl border border-[#d2dceb] bg-[#f7faff] p-3">
              {renaming ? (
                <form className="space-y-2" onSubmit={handleRenameConversation}>
                  <input
                    className="advisor-input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    maxLength={500}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="advisor-btn advisor-btn-primary px-3 py-2 text-xs">Guardar</button>
                    <button type="button" className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-xs font-semibold text-[#162944]" onClick={() => { setRenaming(false); setRenameValue(formatConversationLabel(activeConversation)); }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3a4f67]">Conversacion activa</p>
                    <p className="mt-1 text-sm font-semibold text-[#162944]">{formatConversationLabel(activeConversation)}</p>
                  </div>
                  <button
                    type="button"
                    className="advisor-btn border border-[#b8c8de] bg-white px-3 py-2 text-xs font-semibold text-[#162944]"
                    onClick={() => {
                      setRenameValue(formatConversationLabel(activeConversation));
                      setRenaming(true);
                    }}
                  >
                    Renombrar
                  </button>
                </div>
              )}
            </div>
          )}
          {conversationError && (
            <div className="advisor-alert advisor-alert-error mt-3">{conversationError}</div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {conversations.length === 0 ? (
            <div className="advisor-card-muted p-4 text-sm text-[#3a4f67]">No hay conversaciones guardadas.</div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => loadConversation(conversation.id)}
                    className={
                      "w-full rounded-xl border p-3 text-left transition " +
                      (isActive
                        ? "border-[#1dab89] bg-[#eefbf6]"
                        : "border-[#d2dceb] bg-white hover:bg-[#f7faff]")
                    }
                  >
                    <p className="text-sm font-semibold text-[#162944]">{formatConversationLabel(conversation)}</p>
                    <p className="mt-1 text-xs text-[#3a4f67]">{formatConversationDate(conversation.updated_at)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="advisor-card flex min-h-0 flex-1 flex-col overflow-hidden lg:col-span-3">
        <div className="flex shrink-0 items-center justify-between bg-[#162944] p-4 text-white">
          <h2 className="advisor-heading text-xl">Anclora Advisor AI</h2>
          <span className="rounded-full bg-[#1DAB89] px-2.5 py-1 text-xs font-semibold text-white">Persisted</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7faff] p-4">
          {messages.length === 0 && !conversationLoading && (
            <div className="flex h-full items-center justify-center px-6 text-center text-gray-500">
              <p>Escribe tu consulta normativa, fiscal o de mercado inmobiliario para comenzar.</p>
            </div>
          )}
          {conversationLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-gray-500">
              <p>Cargando conversacion...</p>
            </div>
          ) : (
            <MessageList messages={messages} actionStates={actionStates} onExecuteAction={executeSuggestedAction} />
          )}

          {loading && (
            <div className="mt-4 flex justify-start">
              <div className="flex items-center gap-3 rounded-lg border border-[#d2dceb] bg-white p-4 shadow-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1DAB89] border-t-transparent"></div>
                <p className="text-sm font-medium text-[#3a4f67]">Generando respuesta en streaming...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Error de conexión:</strong> {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#d2dceb] bg-white p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ej. ¿Qué riesgos asumo si abro una consultora IA mientras trabajo por cuenta ajena?"
              disabled={loading || conversationLoading}
              className="flex-1 rounded-lg border border-[#c7d4e6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DAB89] disabled:cursor-not-allowed disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={loading || conversationLoading || !inputQuery.trim()}
              className="rounded-lg bg-[#1DAB89] px-6 py-3 font-bold text-white transition-colors hover:bg-[#179a7a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Consultar
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#3a4f67]">
            <span>Acciones rapidas disponibles tras respuestas compatibles.</span>
            <Link href="/dashboard/fiscal" className="font-semibold text-[#1dab89] hover:underline">Fiscal</Link>
            <Link href="/dashboard/laboral" className="font-semibold text-[#1dab89] hover:underline">Laboral</Link>
            <Link href="/dashboard/facturacion" className="font-semibold text-[#1dab89] hover:underline">Facturacion</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
