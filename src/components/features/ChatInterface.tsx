// src/components/features/ChatInterface.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import type { ChatSuggestedAction } from "@/lib/chat/action-suggestions";
import type { ChatConversationRecord, ChatPersistedMessageRecord } from "@/lib/chat/contracts";
import { resolveExactNavigationHref } from "@/lib/chat/entity-resolution";
import { uiText } from "@/lib/i18n/ui";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
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

function formatConversationLabel(conversation: ChatConversationRecord, locale: "es" | "en"): string {
  const title = conversation.title?.trim();
  if (!title) {
    return uiText(locale, "chat.default_title");
  }

  if (["Nueva conversacion", "Nueva conversación", "NEW CONVERSATION", "New conversation"].includes(title)) {
    return uiText(locale, "chat.default_title");
  }

  return title;
}

function formatConversationDate(value: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
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
  const { locale } = useAppPreferences();
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
      throw new Error(result.error ?? uiText(locale, "chat.error.refresh"));
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
        throw new Error(result.error ?? uiText(locale, "chat.error.load"));
      }

      const nextMessages = result.messages
        .map(mapPersistedMessage)
        .filter((message): message is ChatMessage => message !== null);
      setActiveConversationId(conversationId);
      replaceMessages(nextMessages);
      syncConversationInUrl(conversationId);
    } catch (loadError) {
      setConversationError(loadError instanceof Error ? loadError.message : uiText(locale, "chat.error.load"));
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
        body: JSON.stringify({ title: uiText(locale, "chat.default_title") }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        conversation?: ChatConversationRecord;
      };

      if (!response.ok || !result.success || !result.conversation) {
        throw new Error(result.error ?? uiText(locale, "chat.error.create"));
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

      setRenameValue(formatConversationLabel(nextConversation, locale));
      return nextConversation;
    } catch (createError) {
      setConversationError(createError instanceof Error ? createError.message : uiText(locale, "chat.error.create"));
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
        throw new Error(result.error ?? uiText(locale, "chat.error.rename"));
      }

      setConversations((prev) =>
        prev.map((item) => (item.id === result.conversation?.id ? (result.conversation as ChatConversationRecord) : item))
      );
      setRenaming(false);
    } catch (renameError) {
      setConversationError(renameError instanceof Error ? renameError.message : uiText(locale, "chat.error.rename"));
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
      [stateKey]: { status: "loading", message: uiText(locale, "chat.action.creating") },
    }));

    try {
      let response: Response;
      let successSummary = "";

      if (action.kind === "open_existing_fiscal_alert" || action.kind === "open_existing_labor_assessment" || action.kind === "open_existing_invoice") {
        const resolvedHref = await resolveExactNavigationHref(action);
        router.push(resolvedHref);
        setActionStates((prev) => ({
          ...prev,
          [stateKey]: { status: "success", message: resolvedHref === action.navigationHref ? uiText(locale, "chat.action.filter_opened") : uiText(locale, "chat.action.entity_opened") },
        }));
        appendAssistantMessage({
          content: resolvedHref === action.navigationHref
            ? uiText(locale, "chat.summary.open_filtered")
            : uiText(locale, "chat.summary.open_exact"),
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
        successSummary = uiText(locale, "chat.summary.fiscal_created");
      } else if (action.kind === "create_labor_assessment") {
        response = await fetch("/api/labor-risk-assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        successSummary = uiText(locale, "chat.summary.labor_created");
      } else {
        response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
        successSummary = uiText(locale, "chat.summary.invoice_created");
      }

      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? uiText(locale, "chat.error.execute"));
      }

      setActionStates((prev) => ({
        ...prev,
        [stateKey]: { status: "success", message: uiText(locale, "chat.action.created") },
      }));
      appendAssistantMessage({
        content: `${successSummary} ${locale === "en" ? "You can review it in the corresponding module." : "Puedes revisarla en el módulo correspondiente."}`,
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
          message: actionError instanceof Error ? actionError.message : uiText(locale, "chat.error.execute"),
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
              <h2 className="advisor-heading text-2xl" style={{ color: "var(--text-primary)" }}>{uiText(locale, "chat.sidebar.title")}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{uiText(locale, "chat.sidebar.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={conversationLoading || loading}
              className="advisor-btn advisor-btn-primary px-4 py-2 text-sm"
            >
              {uiText(locale, "chat.new")}
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
                    <button type="submit" className="advisor-btn advisor-btn-primary px-3 py-2 text-xs">{uiText(locale, "chat.save")}</button>
                    <button type="button" className="advisor-btn px-3 py-2 text-xs" style={{ border: "1px solid var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)", color: "var(--text-primary)" }} onClick={() => { setRenaming(false); setRenameValue(formatConversationLabel(activeConversation, locale)); }}>
                      {uiText(locale, "chat.cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{uiText(locale, "chat.active")}</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatConversationLabel(activeConversation, locale)}</p>
                  </div>
                  <button
                    type="button"
                    className="advisor-btn px-3 py-2 text-xs"
                    style={{ border: "1px solid var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)", color: "var(--text-primary)" }}
                    onClick={() => {
                      setRenameValue(formatConversationLabel(activeConversation, locale));
                      setRenaming(true);
                    }}
                  >
                    {uiText(locale, "chat.rename")}
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
              {uiText(locale, "chat.empty_cta")}
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
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatConversationLabel(conversation, locale)}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{formatConversationDate(conversation.updated_at, locale)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="advisor-card flex min-h-0 flex-1 flex-col overflow-hidden lg:col-span-3">
        <div className="flex shrink-0 items-center justify-between border-b p-4" style={{ background: "var(--chat-hero-bg)", borderColor: "var(--chat-hero-border)", color: "var(--chat-hero-text)" }}>
          <h2 className="advisor-heading text-xl">Anclora Advisor AI</h2>
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--chat-hero-badge-bg)", color: "var(--chat-hero-badge-text)" }}>{uiText(locale, "common.persisted")}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ background: "color-mix(in srgb, var(--advisor-panel) 96%, transparent)" }}>
          {messages.length === 0 && !conversationLoading && (
            <div className="flex h-full items-center justify-center px-6 text-center" style={{ color: "var(--text-secondary)" }}>
              <p>{uiText(locale, "chat.empty_prompt")}</p>
            </div>
          )}
          {conversationLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center" style={{ color: "var(--text-secondary)" }}>
              <p>{uiText(locale, "chat.loading")}</p>
            </div>
          ) : (
            <MessageList messages={messages} actionStates={actionStates} onExecuteAction={executeSuggestedAction} />
          )}

          {loading && (
            <div className="mt-4 flex justify-start">
              <div className="flex items-center gap-3 rounded-lg border p-4 shadow-sm" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)" }}>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1DAB89] border-t-transparent"></div>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{uiText(locale, "chat.streaming")}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>{uiText(locale, "chat.error.connection")}</strong> {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)" }}>
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={uiText(locale, "chat.placeholder")}
              disabled={loading || conversationLoading}
              className="advisor-input flex-1 rounded-lg px-4 py-3 text-sm disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || conversationLoading || !inputQuery.trim()}
              className="rounded-lg bg-[#1DAB89] px-6 py-3 font-bold text-white transition-colors hover:bg-[#179a7a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {uiText(locale, "chat.send")}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{uiText(locale, "chat.quick_actions")}</span>
            <Link href="/dashboard/fiscal" className="font-semibold text-[#1dab89] hover:underline">{uiText(locale, "chat.link.fiscal")}</Link>
            <Link href="/dashboard/laboral" className="font-semibold text-[#1dab89] hover:underline">{uiText(locale, "chat.link.labor")}</Link>
            <Link href="/dashboard/facturacion" className="font-semibold text-[#1dab89] hover:underline">{uiText(locale, "chat.link.invoice")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
