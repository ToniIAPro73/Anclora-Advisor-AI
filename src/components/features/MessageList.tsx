// src/components/features/MessageList.tsx
import React from "react";
import { ChatMessage } from "@/hooks/useChat";

interface MessageListProps {
  messages: ChatMessage[];
  actionStates: Record<string, { status: "idle" | "loading" | "success" | "error"; message: string | null }>;
  // eslint-disable-next-line no-unused-vars
  onExecuteAction: (...args: [string, NonNullable<ChatMessage["suggestedActions"]>[number]]) => Promise<void>;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, actionStates, onExecuteAction }) => {
  const [expandedMessageId, setExpandedMessageId] = React.useState<string | null>(null);

  function getGroundingBadgeClass(confidence: ChatMessage["groundingConfidence"]): string {
    if (confidence === "high") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (confidence === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
    if (confidence === "low") return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

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

            {msg.role === "assistant" && msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div className="mt-3 space-y-2">
                {msg.suggestedActions.map((action) => {
                  const state = actionStates[`${msg.id}:${action.id}`] ?? { status: "idle", message: null };
                  return (
                    <div key={`${msg.id}_${action.id}`} className="rounded-lg border border-[#d2dceb] bg-[#f7faff] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#162944]">{action.title}</p>
                          <p className="mt-1 text-xs text-[#3a4f67]">{action.description}</p>
                        </div>
                        <a href={action.navigationHref} className="text-xs font-semibold text-[#1dab89] hover:underline">
                          Ir al modulo
                        </a>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onExecuteAction(msg.id, action)}
                          disabled={state.status === "loading" || state.status === "success"}
                          className="rounded-lg bg-[#1DAB89] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#179a7a] disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {state.status === "loading" ? "Creando..." : state.status === "success" ? "Creado" : action.ctaLabel}
                        </button>
                        {state.message && (
                          <span
                            className={
                              "text-xs " +
                              (state.status === "error"
                                ? "text-red-700"
                                : state.status === "success"
                                  ? "text-emerald-700"
                                  : "text-[#3a4f67]")
                            }
                          >
                            {state.message}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {msg.role === "assistant" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                    className="flex items-center gap-1 text-[#162944] hover:underline text-xs font-semibold"
                  >
                    <span className={"inline-block transition-transform " + (expandedMessageId === msg.id ? "rotate-180" : "")}>v</span>
                    {expandedMessageId === msg.id ? "Ocultar" : "Ver"} detalles y evidencia
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {typeof msg.groundingConfidence === "string" && (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getGroundingBadgeClass(msg.groundingConfidence)}`}>
                        grounding: {msg.groundingConfidence}
                      </span>
                    )}
                    {msg.citations && msg.citations.length > 0 && (
                      <span className="rounded-full border border-[#d2dceb] bg-[#f4f8ff] px-2 py-0.5 text-[11px] font-semibold text-[#162944]">
                        {msg.citations.length} fuente(s)
                      </span>
                    )}
                  </div>
                </div>
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
                {msg.contexts && msg.contexts.length > 0 && msg.contexts[0]?.warnings?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700">
                    {msg.contexts[0].warnings.join(" ")}
                  </div>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div>
                    <p className="font-semibold text-[#162944]">Fuentes y evidencia</p>
                    <div className="mt-2 space-y-2">
                      {msg.citations.map((citation) => {
                        const matchingChunk = msg.contexts
                          ?.flatMap((context) => context.chunks)
                          .find((chunk) => chunk.id === citation.chunk_id);

                        return (
                          <div key={`${msg.id}_citation_${citation.chunk_id}`} className="rounded-lg border border-[#d2dceb] bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[#162944]">
                                  [{citation.index}] {citation.title}
                                </p>
                                <p className="mt-1 text-[11px] text-[#3a4f67]">
                                  similitud: {(citation.similarity * 100).toFixed(0)}%
                                </p>
                              </div>
                              {citation.source_url ? (
                                <a
                                  href={citation.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-semibold text-[#1dab89] hover:underline"
                                >
                                  Abrir fuente
                                </a>
                              ) : (
                                <span className="text-[11px] text-[#3a4f67]">Sin URL</span>
                              )}
                            </div>
                            {matchingChunk && (
                              <div className="mt-2 rounded-md bg-[#f7faff] p-2 text-[12px] leading-relaxed text-[#3a4f67]">
                                {matchingChunk.content}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
