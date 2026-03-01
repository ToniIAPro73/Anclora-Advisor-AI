// src/hooks/useChat.ts
/**
 * HOOK: useChat - Integracion Frontend del Orchestrator
 */

import { useState, useCallback, useEffect } from "react";
import type { ChatSuggestedAction } from "@/lib/chat/action-suggestions";

export type AlertLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ChatAlert {
  type: AlertLevel;
  message: string;
}

export interface ChatRouting {
  primarySpecialist: string;
  confidence: number;
}

export interface ChatCitation {
  index: number;
  title: string;
  source_url: string;
  similarity: number;
  chunk_id: string;
}

export interface ChatContextChunk {
  id: string;
  content: string;
  source: string;
  confidence: number;
}

export interface ChatContext {
  chunks: ChatContextChunk[];
  totalConfidence: number;
  warnings: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  routing?: ChatRouting;
  citations?: ChatCitation[];
  contexts?: ChatContext[];
  alerts?: ChatAlert[];
  suggestedActions?: ChatSuggestedAction[];
  groundingConfidence?: "high" | "medium" | "low" | "none";
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

interface ChatApiResponse {
  success: boolean;
  error?: string;
  messageId?: string;
  primarySpecialistResponse?: string;
  routing?: ChatRouting;
  citations?: ChatCitation[];
  contexts?: ChatContext[];
  alerts?: ChatAlert[];
  suggestedActions?: ChatSuggestedAction[];
  groundingConfidence?: "high" | "medium" | "low" | "none";
}

interface ChatStreamCompleteEvent extends ChatApiResponse {
  performance?: Record<string, unknown>;
}

function buildAssistantMessageFromApiResponse(
  current: ChatMessage,
  response: ChatApiResponse
): ChatMessage {
  return {
    ...current,
    content: response.primarySpecialistResponse || current.content,
    routing: response.routing,
    citations: response.citations ?? [],
    contexts: response.contexts ?? [],
    alerts: response.alerts ?? [],
    suggestedActions: response.suggestedActions ?? [],
    groundingConfidence: response.groundingConfidence,
  };
}

export function useChat(userId: string, conversationId: string, initialMessages: ChatMessage[] = []) {
  const [state, setState] = useState<ChatState>({ messages: initialMessages, loading: false, error: null });

  useEffect(() => {
    setState({ messages: initialMessages, loading: false, error: null });
  }, [conversationId, initialMessages]);

  const replaceMessages = useCallback((messages: ChatMessage[]) => {
    setState({ messages, loading: false, error: null });
  }, []);

  const sendMessageStreaming = useCallback(async (query: string, targetConversationId?: string) => {
    if (!query.trim()) return;

    const resolvedConversationId = targetConversationId ?? conversationId;
    if (!resolvedConversationId) {
      throw new Error("No hay una conversacion activa para enviar mensajes.");
    }

    const baseId = Date.now();
    const userMessage: ChatMessage = {
      id: `msg_${baseId}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    const assistantId = `msg_assistant_${baseId}`;
    const placeholderMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      citations: [],
      contexts: [],
      alerts: [],
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage, placeholderMessage],
      loading: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, conversationId: resolvedConversationId, query }),
      });

      if (!response.ok || !response.body) {
        throw new Error("No se pudo iniciar el streaming del chat.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateAssistantMessage = (updater: (...args: [ChatMessage]) => ChatMessage) => {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === assistantId ? updater(message) : message
          ),
        }));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split("\n");
          const eventLine = lines.find((line) => line.startsWith("event: "));
          const dataLine = lines.find((line) => line.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace("event: ", "").trim();
          const data = JSON.parse(dataLine.replace("data: ", "")) as
            | { delta?: string; error?: string }
            | ChatStreamCompleteEvent;

          if (event === "chunk") {
            const delta = "delta" in data ? data.delta ?? "" : "";
            updateAssistantMessage((current) => ({
              ...current,
              content: `${current.content}${delta}`,
            }));
            continue;
          }

          if (event === "complete") {
            const complete = data as ChatStreamCompleteEvent;
            updateAssistantMessage((current) => buildAssistantMessageFromApiResponse(current, complete));
            continue;
          }

          if (event === "error") {
            const message = "error" in data ? data.error ?? "Error de chat no controlado." : "Error de chat no controlado.";
            throw new Error(message);
          }
        }
      }

      setState((prev) => ({ ...prev, loading: false, error: null }));
    } catch (error) {
      try {
        const fallbackResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, conversationId: resolvedConversationId, query }),
        });
        const fallbackResult = (await fallbackResponse.json()) as ChatApiResponse;

        if (!fallbackResponse.ok || !fallbackResult.success) {
          throw new Error(fallbackResult.error ?? "No se pudo recuperar la respuesta del chat.");
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          messages: prev.messages.map((message) =>
            message.id === assistantId ? buildAssistantMessageFromApiResponse(message, fallbackResult) : message
          ),
        }));
        return;
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error
          ? fallbackError.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          messages: prev.messages.filter((message) => message.id !== assistantId),
        }));
        throw fallbackError;
      }
    }
  }, [userId, conversationId]);

  const clearMessages = useCallback(() => {
    setState({ messages: [], loading: false, error: null });
  }, []);

  const appendAssistantMessage = useCallback((message: Omit<ChatMessage, "id" | "role" | "timestamp">) => {
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `msg_local_${Date.now()}`,
          role: "assistant",
          timestamp: new Date(),
          ...message,
        },
      ],
    }));
  }, []);

  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    sendMessageStreaming,
    clearMessages,
    replaceMessages,
    appendAssistantMessage,
  };
}
