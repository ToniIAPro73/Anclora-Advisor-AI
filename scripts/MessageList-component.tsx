// src/components/features/MessageList.tsx
/**
 * COMPONENTE: MessageList
 * 
 * Renderiza historial de mensajes con:
 * - Indicador de qué specialist respondió
 * - Alertas críticas
 * - Citas de fuentes
 * - Información de routing
 */

import React from "react";
import { ChatMessage } from "@/hooks/useChat";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const [expandedMessageId, setExpandedMessageId] = React.useState<
    string | null
  >(null);

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-2xl rounded-lg px-4 py-3 ${
              msg.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-900 border border-gray-200 shadow-sm"
            }`}
          >
            {/* Contenido principal */}
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>

            {/* Metadata (solo para mensajes del assistant) */}
            {msg.role === "assistant" && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm text-gray-600">
                {/* Routing Info */}
                {msg.routing && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Specialist:</span>
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                      {msg.routing.primarySpecialist}
                    </span>
                    <span className="text-xs opacity-75">
                      (Confianza: {(msg.routing.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}

                {/* Alerts */}
                {msg.alerts && msg.alerts.length > 0 && (
                  <div className="space-y-1">
                    {msg.alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${
                          alert.type === "CRITICAL"
                            ? "bg-red-100 text-red-800"
                            : alert.type === "HIGH"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="text-xs">
                    <strong>Fuentes:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.citations.map((citation, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
                        >
                          {citation}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expandible Details */}
                <button
                  onClick={() =>
                    setExpandedMessageId(
                      expandedMessageId === msg.id ? null : msg.id
                    )
                  }
                  className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${
                      expandedMessageId === msg.id ? "rotate-180" : ""
                    }`}
                  />
                  {expandedMessageId === msg.id ? "Ocultar" : "Ver"}
                  {" detalles"}
                </button>
              </div>
            )}

            {/* Detalles expandibles */}
            {msg.role === "assistant" &&
              expandedMessageId === msg.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  <p>
                    <strong>ID del Mensaje:</strong> {msg.id}
                  </p>
                  <p>
                    <strong>Timestamp:</strong>{" "}
                    {msg.timestamp.toLocaleString("es-ES")}
                  </p>
                  {msg.routing && (
                    <p>
                      <strong>Confianza del Router:</strong>{" "}
                      {(msg.routing.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;
