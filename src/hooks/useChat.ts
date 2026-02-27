// src/hooks/useChat.ts
/**
 * HOOK: useChat - Integración Frontend del Orchestrator
 */

import { useState, useCallback } from "react";

export type AlertLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ChatAlert {
  type: AlertLevel;
  message: string;
}

export interface ChatRouting {
  primarySpecialist: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  routing?: ChatRouting;
  citations?: string[];
  alerts?: ChatAlert[];
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
  citations?: string[];
  alerts?: ChatAlert[];
}

export function useChat(userId: string, conversationId: string) {
  const [state, setState] = useState<ChatState>({ messages: [], loading: false, error: null });

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setState((prev) => ({ ...prev, messages: [...prev.messages, userMessage], loading: true, error: null }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, conversationId, query }),
      });

      const data = (await response.json()) as ChatApiResponse;
      if (!response.ok || !data.success) throw new Error(data.error || "Error de chat no controlado.");

      const assistantMessage: ChatMessage = {
        id: data.messageId || "msg_assistant_" + Date.now(),
        role: "assistant",
        content: data.primarySpecialistResponse || "No se pudo construir una respuesta valida.",
        timestamp: new Date(),
        routing: data.routing,
        citations: data.citations ?? [],
        alerts: data.alerts ?? [],
      };

      setState((prev) => ({ ...prev, messages: [...prev.messages, assistantMessage], loading: false, error: null }));
      return assistantMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, [userId, conversationId]);

  const clearMessages = useCallback(() => {
    setState({ messages: [], loading: false, error: null });
  }, []);

  return { messages: state.messages, loading: state.loading, error: state.error, sendMessage, clearMessages };
}
