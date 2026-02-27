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
          <div className={"max-w-2xl rounded-lg px-4 py-3 " + (msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-900 border border-gray-200 shadow-sm")}>
            
            <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>

            {msg.role === "assistant" && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                  className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                >
                  <span className={"inline-block transition-transform " + (expandedMessageId === msg.id ? "rotate-180" : "")}>v</span>
                  {expandedMessageId === msg.id ? "Ocultar" : "Ver"} detalles
                </button>
              </div>
            )}

            {msg.role === "assistant" && expandedMessageId === msg.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <p><strong>ID del Mensaje:</strong> {msg.id}</p>
                <p><strong>Timestamp:</strong> {msg.timestamp.toLocaleString("es-ES")}</p>
                {msg.routing && (
                  <p><strong>Especialista Asignado:</strong> {msg.routing.primarySpecialist} ({(msg.routing.confidence * 100).toFixed(1)}%)</p>
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
