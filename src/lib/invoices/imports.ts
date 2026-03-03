import { inflateSync } from "node:zlib";
import type { InvoiceRecord } from "@/lib/invoices/contracts";

export const INVOICE_IMPORTS_BUCKET = process.env.SUPABASE_INVOICE_IMPORTS_BUCKET?.trim() || "invoice-imports";

export type ParsedInvoiceImport = {
  clientName: string;
  clientNif: string;
  amountBase: number;
  ivaRate: number;
  irpfRetention: number;
  totalAmount: number;
  issueDate: string;
  series: string;
  recipientEmail?: string;
  confidence: number;
  extractedText: string;
};

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function sanitizePrintableText(value: string): string {
  const printable = Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (char === "\n" || char === "\r" || char === "\t") {
        return char;
      }
      if ((code >= 32 && code <= 126) || code >= 160) {
        return char;
      }
      return " ";
    })
    .join("");

  return normalizeWhitespace(
    printable
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, " ")
  );
}

function decodePdfStreams(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [sanitizePrintableText(raw)];
  let cursor = 0;

  while (cursor < raw.length) {
    const streamIndex = raw.indexOf("stream", cursor);
    if (streamIndex === -1) break;
    const lineEnd = raw.indexOf("\n", streamIndex);
    if (lineEnd === -1) break;
    const dataStart = lineEnd + 1;
    const endIndex = raw.indexOf("endstream", dataStart);
    if (endIndex === -1) break;

    const dictStart = Math.max(0, streamIndex - 300);
    const dictRaw = raw.slice(dictStart, streamIndex);
    const streamBuffer = buffer.subarray(dataStart, endIndex).subarray(0);

    try {
      const decoded = dictRaw.includes("/FlateDecode") ? inflateSync(streamBuffer).toString("latin1") : streamBuffer.toString("latin1");
      chunks.push(sanitizePrintableText(decoded));
    } catch {
      chunks.push(sanitizePrintableText(streamBuffer.toString("latin1")));
    }

    cursor = endIndex + "endstream".length;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function extractCandidateLines(buffer: Buffer): string[] {
  const chunks = decodePdfStreams(buffer);
  const lines = new Set<string>();

  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      const candidate = line.trim();
      if (candidate.length >= 3) {
        lines.add(candidate);
      }
    }
  }

  return Array.from(lines);
}

function parseDecimal(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateToIso(raw: string): string | null {
  const match = raw.match(/(\d{2})[/. -](\d{2})[/. -](\d{4})|(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  if (match[4] && match[5] && match[6]) {
    return `${match[4]}-${match[5]}-${match[6]}`;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function getFieldFromLines(lines: string[], labels: string[]): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    const matchingLabel = labels.find((label) => lower.includes(label));
    if (!matchingLabel) continue;

    const split = line.split(/[:：]/);
    const inlineValue = split.length > 1 ? split.slice(1).join(":").trim() : "";
    if (inlineValue) return inlineValue;

    const nextLine = lines[index + 1]?.trim();
    if (nextLine && !labels.some((label) => nextLine.toLowerCase().includes(label))) {
      return nextLine;
    }
  }

  return null;
}

function getAmountFromText(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\d]{0,24}(-?[\\d.,]+\\s?(?:€|eur)?)`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      const parsed = parseDecimal(match[1]);
      if (parsed > 0) return parsed;
    }
  }
  return null;
}

function getRateFromText(text: string, label: string): number | null {
  const regex = new RegExp(`${label}[^\\d]{0,24}(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*%`, "i");
  const match = text.match(regex);
  if (!match?.[1]) return null;
  const parsed = parseDecimal(match[1]);
  return parsed >= 0 ? parsed : null;
}

export function buildInvoiceImportStoragePath(userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
}

export function parseInvoicePdf(buffer: Buffer): ParsedInvoiceImport {
  const lines = extractCandidateLines(buffer);
  const extractedText = normalizeWhitespace(lines.join("\n"));
  if (!extractedText) {
    throw new Error("PDF_TEXT_EXTRACTION_FAILED");
  }

  const clientName = getFieldFromLines(lines, ["cliente", "client"]);
  const clientNif = getFieldFromLines(lines, ["nif", "cif", "vat", "tax id"]);
  const recipientEmail = extractedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const issueDateRaw =
    getFieldFromLines(lines, ["fecha de emision", "fecha emisión", "emitida el", "issue date", "fecha"]) ??
    extractedText.match(/(?:fecha de emision|fecha emisión|emitida el|issue date|fecha)[^\d]{0,12}(\d{2}[/. -]\d{2}[/. -]\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1] ??
    null;
  const issueDate = issueDateRaw ? parseDateToIso(issueDateRaw) : null;
  const series = getFieldFromLines(lines, ["serie", "series"]) ?? (issueDate ? issueDate.slice(0, 4) : new Date().toISOString().slice(0, 4));

  const amountBase = getAmountFromText(extractedText, ["base imponible", "tax base", "base"]);
  const totalAmount = getAmountFromText(extractedText, ["total factura", "importe total", "total"]);
  const ivaRate = getRateFromText(extractedText, "iva") ?? 21;
  const irpfRetention = getRateFromText(extractedText, "irpf") ?? 0;

  const requiredSignals = [
    clientName,
    clientNif,
    issueDate,
    amountBase ? "1" : "",
    totalAmount ? "1" : "",
  ].filter(Boolean).length;
  const confidence = Number((requiredSignals / 5).toFixed(2));

  if (!clientName || !clientNif || !issueDate || !amountBase || !totalAmount) {
    throw new Error("PDF_IMPORT_PARSE_FAILED");
  }

  return {
    clientName,
    clientNif,
    amountBase,
    ivaRate,
    irpfRetention,
    totalAmount,
    issueDate,
    series,
    recipientEmail: recipientEmail ?? undefined,
    confidence,
    extractedText,
  };
}

export function buildImportedInvoicePatch(params: {
  invoice: InvoiceRecord;
  fileName: string;
  storagePath: string;
  confidence: number;
}): Partial<InvoiceRecord> {
  return {
    ...params.invoice,
    import_source: "pdf_import",
    import_file_name: params.fileName,
    import_storage_path: params.storagePath,
    import_confidence: params.confidence,
    imported_at: new Date().toISOString(),
  };
}
