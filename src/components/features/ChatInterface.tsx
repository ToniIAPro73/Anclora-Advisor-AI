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
    <div className="flex flex-col h-[80vh] bg-gray-100 rounded-xl overflow-hidden shadow-xl">
      <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
        <h2 className="text-lg font-bold tracking-wider">Anclora Advisor AI</h2>
        <span className="text-xs px-2 py-1 bg-amber-500 text-slate-900 rounded font-semibold">Beta</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 text-center px-6">
            <p>Escribe tu consulta normativa, fiscal o de mercado inmobiliario para comenzar.</p>
          </div>
        )}
        <MessageList messages={messages} />
        
        {loading && (
          <div className="flex justify-start mt-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 shadow-sm">
              <div className="animate-spin h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full"></div>
              <p className="text-sm text-gray-600 font-medium">Analizando directrices y jurisprudencia...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            <strong>Error de conexión:</strong> {error}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ej. ¿Qué riesgos asumo si abro una consultora IA mientras trabajo por cuenta ajena?"
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 disabled:cursor-not-allowed text-sm"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Consultar
          </button>
        </form>
      </div>
    </div>
  );
};
