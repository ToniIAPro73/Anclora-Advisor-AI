// src/hooks/useChat.ts
/**
 * HOOK: useChat - Integración Frontend del Orchestrator
 * 
 * Permite que componentes React interactúen con los Specialists
 * sin conocer detalles internos del orchestrator
 * 
 * Uso:
 * const { sendMessage, messages, loading, error } = useChat(userId, conversationId);
 * await sendMessage("¿Cuál es el plazo para presentar IVA?");
 */

import { useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  routing?: {
    primarySpecialist: string;
    confidence: number;
  };
  citations?: string[];
  alerts?: Array<{ type: string; message: string }>;
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  processingTime?: number;
}

export function useChat(userId: string, conversationId: string) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    loading: false,
    error: null,
  });

  /**
   * Envía mensaje al orchestrator
   */
  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      // Agregar mensaje del usuario
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: query,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        loading: true,
        error: null,
      }));

      try {
        // Llamar al endpoint /api/chat
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            conversationId,
            query,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Unknown error");
        }

        // Agregar mensaje del assistant
        const assistantMessage: ChatMessage = {
          id: data.messageId || `msg_assistant_${Date.now()}`,
          role: "assistant",
          content: data.primarySpecialistResponse,
          timestamp: new Date(),
          routing: {
            primarySpecialist: data.routing.primarySpecialist,
            confidence: data.routing.confidence,
          },
          citations: data.citations,
          alerts: data.alerts,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          loading: false,
          error: null,
        }));

        return assistantMessage;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [userId, conversationId]
  );

  /**
   * Limpia el historial de mensajes
   */
  const clearMessages = useCallback(() => {
    setState({
      messages: [],
      loading: false,
      error: null,
    });
  }, []);

  /**
   * Retorna estado y funciones
   */
  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    sendMessage,
    clearMessages,
  };
}
