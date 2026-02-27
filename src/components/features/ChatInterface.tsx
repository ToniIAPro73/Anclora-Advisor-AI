// src/components/features/ChatInterface.tsx
"use client";

import React, { useState } from "react";
import { useChat } from "@/hooks/useChat";
import MessageList from "./MessageList";

interface ChatInterfaceProps {
  userId: string;
  conversationId: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId, conversationId }) => {
  const { messages, loading, error, sendMessage } = useChat(userId, conversationId);
  const [inputQuery, setInputQuery] = useState("");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    try {
      await sendMessage(inputQuery);
      setInputQuery("");
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  return (
    <div className="advisor-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between bg-[#162944] p-4 text-white">
        <h2 className="advisor-heading text-xl">Anclora Advisor AI</h2>
        <span className="rounded-full bg-[#1DAB89] px-2.5 py-1 text-xs font-semibold text-white">Live</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7faff] p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center text-gray-500">
            <p>Escribe tu consulta normativa, fiscal o de mercado inmobiliario para comenzar.</p>
          </div>
        )}
        <MessageList messages={messages} />

        {loading && (
          <div className="flex justify-start mt-4">
            <div className="flex items-center gap-3 rounded-lg border border-[#d2dceb] bg-white p-4 shadow-sm">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1DAB89] border-t-transparent"></div>
              <p className="text-sm font-medium text-[#3a4f67]">Analizando directrices y jurisprudencia...</p>
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
            disabled={loading}
            className="flex-1 rounded-lg border border-[#c7d4e6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DAB89] disabled:cursor-not-allowed disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="rounded-lg bg-[#1DAB89] px-6 py-3 font-bold text-white transition-colors hover:bg-[#179a7a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            Consultar
          </button>
        </form>
      </div>
    </div>
  );
};
