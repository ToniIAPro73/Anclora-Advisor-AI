export type LocaleCode = "es" | "en";

type MessageDict = Record<string, string>;

const ES: MessageDict = {
  "api.chat.missing_fields": "Faltan campos requeridos: userId, conversationId, query",
  "api.chat.processing_error": "Error procesando la consulta",
  "api.invoices.missing_session": "Falta token de sesión",
  "api.invoices.invalid_session": "Token de sesión inválido",
  "api.invoices.invalid_payload": "Payload de factura inválido",
  "api.invoices.db_error": "Error de base de datos al procesar facturas",
};

const EN: MessageDict = {
  "api.chat.missing_fields": "Missing required fields: userId, conversationId, query",
  "api.chat.processing_error": "Error processing query",
  "api.invoices.missing_session": "Missing session token",
  "api.invoices.invalid_session": "Invalid session token",
  "api.invoices.invalid_payload": "Invalid invoice payload",
  "api.invoices.db_error": "Database error while processing invoices",
};

export const I18N_MESSAGES: Record<LocaleCode, MessageDict> = {
  es: ES,
  en: EN,
};

export function resolveLocale(input?: string | null): LocaleCode {
  const raw = (input ?? "").toLowerCase();
  return raw.startsWith("en") ? "en" : "es";
}

export function t(locale: LocaleCode, key: string): string {
  return I18N_MESSAGES[locale][key] ?? I18N_MESSAGES.es[key] ?? key;
}

