// src/components/features/ChatInterface.tsx
/**
 * COMPONENTE: ChatInterface
 * 
 * Interfaz de chat que usa el hook useChat para comunicarse con Orchestrator
 * Renderiza:
 * - Historial de mensajes
 * - Info de routing (qué specialist se usó)
 * - Alertas críticas
 * - Input para nuevas queries
 */

"use client";

import React, { useState } from "react";
import { useChat } from "@/hooks/useChat";
import MessageList from "./MessageList";
import AlertsWidget from "./AlertsWidget";

interface ChatInterfaceProps {
  userId: string;
  conversationId: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId,
  conversationId,
}) => {
  const { messages, loading, error, sendMessage, clearMessages } = useChat(
    userId,
    conversationId
  );
  const [inputQuery, setInputQuery] = useState("");
  const [forceSpecialist, setForceSpecialist] = useState<
    "fiscal" | "labor" | "market" | null
  >(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    try {
      await sendMessage(inputQuery);
      setInputQuery("");
      setForceSpecialist(null);
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Anclora Advisor AI
        </h2>

        {/* Alerts Widget */}
        <div className="mb-6">
          <AlertsWidget alerts={messages.flatMap((m) => m.alerts || [])} />
        </div>

        {/* Selector de Specialist (Testing) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Forzar Specialist (testing):
          </label>
          <select
            value={forceSpecialist || ""}
            onChange={(e) =>
              setForceSpecialist((e.target.value as any) || null)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Auto (Router)</option>
            <option value="fiscal">Fiscal</option>
            <option value="labor">Labor</option>
            <option value="market">Market</option>
          </select>
        </div>

        {/* Clear Button */}
        <button
          onClick={clearMessages}
          className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-md transition"
        >
          Nueva Conversación
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">
            Asesor Fiscal, Laboral y de Mercado
          </h1>
          <p className="text-sm text-gray-600">
            Consultas sobre RETA, IVA, riesgo laboral, pluriactividad y
            mercado inmobiliario
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Comienza escribiendo tu pregunta...</p>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full"></div>
                  <p className="text-gray-600">Procesando consulta...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Escribe tu pregunta sobre fiscalidad, laboral o mercado..."
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
