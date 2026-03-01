// src/components/features/ChatInterface.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import type { ChatSuggestedAction } from "@/lib/chat/action-suggestions";
import type { ChatConversationRecord, ChatPersistedMessageRecord } from "@/lib/chat/contracts";
import { resolveExactNavigationHref } from "@/lib/chat/entity-resolution";
import MessageList from "./MessageList";

interface ChatInterfaceProps {
  userId: string;
  initialConversationId: string | null;
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
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
    activeConversationId ?? "",
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

  async function createConversation(options?: { activate?: boolean; resetMessages?: boolean }) {
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

      const nextConversation = result.conversation as ChatConversationRecord;
      setConversations((prev) => [nextConversation, ...prev]);

      if (options?.activate ?? true) {
        setActiveConversationId(nextConversation.id);
        syncConversationInUrl(nextConversation.id);
      }

      if (options?.resetMessages ?? true) {
        replaceMessages([]);
      }

      setRenameValue(formatConversationLabel(nextConversation));
      return nextConversation;
    } catch (createError) {
      setConversationError(createError instanceof Error ? createError.message : "Error al crear la conversacion");
      return null;
    } finally {
      setConversationLoading(false);
    }
  }

  async function handleNewConversation() {
    await createConversation({ activate: true, resetMessages: true });
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
      let targetConversationId = activeConversationId;

      if (!targetConversationId) {
        const createdConversation = await createConversation({ activate: true, resetMessages: true });
        if (!createdConversation) {
          return;
        }
        targetConversationId = createdConversation.id;
      }

      await sendMessageStreaming(inputQuery, targetConversationId);
      setInputQuery("");
      await refreshConversations(targetConversationId);
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

      if (action.kind === "open_existing_fiscal_alert" || action.kind === "open_existing_labor_assessment" || action.kind === "open_existing_invoice") {
        const resolvedHref = await resolveExactNavigationHref(action);
        router.push(resolvedHref);
        setActionStates((prev) => ({
          ...prev,
          [stateKey]: { status: "success", message: resolvedHref === action.navigationHref ? "Filtro aplicado en el modulo correspondiente." : "Entidad localizada y abierta en su modulo." },
        }));
        appendAssistantMessage({
          content: resolvedHref === action.navigationHref
            ? "He abierto el modulo con un filtro precargado para revisar entidades ya existentes relacionadas con esta consulta."
            : "He localizado una entidad ya existente y he abierto el modulo directamente sobre ese registro.",
          suggestedActions: [],
          alerts: [],
          citations: [],
          contexts: [],
        });
        return;
      }

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
        <div className="shrink-0 border-b p-4" style={{ borderColor: "var(--advisor-border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="advisor-heading text-2xl" style={{ color: "var(--text-primary)" }}>Conversaciones</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Historial persistido por usuario.</p>
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
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--advisor-border)", background: "var(--advisor-panel-muted)" }}>
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
                    <button type="button" className="advisor-btn px-3 py-2 text-xs" style={{ border: "1px solid var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)", color: "var(--text-primary)" }} onClick={() => { setRenaming(false); setRenameValue(formatConversationLabel(activeConversation)); }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Conversacion activa</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatConversationLabel(activeConversation)}</p>
                  </div>
                  <button
                    type="button"
                    className="advisor-btn px-3 py-2 text-xs"
                    style={{ border: "1px solid var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)", color: "var(--text-primary)" }}
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
            <div className="advisor-card-muted p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              Aun no hay conversaciones guardadas. Pulsa "Nueva" o escribe tu primera consulta para crear una.
            </div>
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
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatConversationLabel(conversation)}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{formatConversationDate(conversation.updated_at)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="advisor-card flex min-h-0 flex-1 flex-col overflow-hidden lg:col-span-3">
        <div className="flex shrink-0 items-center justify-between p-4 text-white" style={{ background: "linear-gradient(135deg, var(--advisor-primary), var(--advisor-dark))" }}>
          <h2 className="advisor-heading text-xl">Anclora Advisor AI</h2>
          <span className="rounded-full bg-[#1DAB89] px-2.5 py-1 text-xs font-semibold text-white">Persisted</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ background: "color-mix(in srgb, var(--advisor-panel) 96%, transparent)" }}>
          {messages.length === 0 && !conversationLoading && (
            <div className="flex h-full items-center justify-center px-6 text-center" style={{ color: "var(--text-secondary)" }}>
              <p>Escribe tu consulta normativa, fiscal o de mercado inmobiliario para comenzar.</p>
            </div>
          )}
          {conversationLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center" style={{ color: "var(--text-secondary)" }}>
              <p>Cargando conversacion...</p>
            </div>
          ) : (
            <MessageList messages={messages} actionStates={actionStates} onExecuteAction={executeSuggestedAction} />
          )}

          {loading && (
            <div className="mt-4 flex justify-start">
              <div className="flex items-center gap-3 rounded-lg border p-4 shadow-sm" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)" }}>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1DAB89] border-t-transparent"></div>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Generando respuesta en streaming...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Error de conexion:</strong> {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)" }}>
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ej. Que riesgos asumo si abro una consultora IA mientras trabajo por cuenta ajena?"
              disabled={loading || conversationLoading}
              className="advisor-input flex-1 rounded-lg px-4 py-3 text-sm disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || conversationLoading || !inputQuery.trim()}
              className="rounded-lg bg-[#1DAB89] px-6 py-3 font-bold text-white transition-colors hover:bg-[#179a7a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Consultar
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
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
