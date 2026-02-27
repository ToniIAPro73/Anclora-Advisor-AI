// src/components/features/MessageList.tsx
import React from "react";
import { ChatMessage } from "@/hooks/useChat";

interface MessageListProps {
  messages: ChatMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const [expandedMessageId, setExpandedMessageId] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={
              "max-w-3xl rounded-xl px-4 py-3 " +
              (msg.role === "user"
                ? "bg-[#1DAB89] text-white shadow-sm"
                : "bg-white text-gray-900 border border-[#d2dceb] shadow-sm")
            }
          >
            {msg.role === "assistant" && msg.alerts && msg.alerts.length > 0 && (
              <div className="mb-3 space-y-2">
                {msg.alerts.map((alert, idx) => (
                  <div
                    key={`${msg.id}_alert_${idx}`}
                    className={
                      "rounded-lg border px-3 py-2 text-sm " +
                      (alert.type === "CRITICAL"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-amber-300 bg-amber-50 text-amber-700")
                    }
                  >
                    <p className="font-semibold">{alert.type === "CRITICAL" ? "Alerta critica" : `Alerta ${alert.type.toLowerCase()}`}</p>
                    <p>{alert.message}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>

            {msg.role === "assistant" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                  className="flex items-center gap-1 text-[#162944] hover:underline text-xs font-semibold"
                >
                  <span className={"inline-block transition-transform " + (expandedMessageId === msg.id ? "rotate-180" : "")}>v</span>
                  {expandedMessageId === msg.id ? "Ocultar" : "Ver"} detalles y fuentes
                </button>
              </div>
            )}

            {msg.role === "assistant" && expandedMessageId === msg.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-700 bg-[#f4f8ff] p-3 rounded-lg space-y-2">
                <p>
                  <strong>ID del Mensaje:</strong> {msg.id}
                </p>
                <p>
                  <strong>Timestamp:</strong> {msg.timestamp.toLocaleString("es-ES")}
                </p>
                {msg.routing && (
                  <p>
                    <strong>Especialista Asignado:</strong> {msg.routing.primarySpecialist} ({(msg.routing.confidence * 100).toFixed(1)}%)
                  </p>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div>
                    <p className="font-semibold text-[#162944]">Fuentes y citas</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {msg.citations.map((citation, index) => (
                        <li key={`${msg.id}_citation_${index}`}>{citation}</li>
                      ))}
                    </ul>
                  </div>
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
