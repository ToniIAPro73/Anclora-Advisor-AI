"use server";

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import type { InvoiceRecord } from "@/lib/invoices/contracts";

export const INVOICE_IMPORTS_BUCKET = process.env.SUPABASE_INVOICE_IMPORTS_BUCKET?.trim() || "invoice-imports";
const INVOICE_IMPORT_VLM_ENABLED = process.env.INVOICE_IMPORT_VLM_ENABLED?.trim() === "true";
const ZAI_VISION_MODEL = process.env.ZAI_VISION_MODEL?.trim() || "glm-4.5v";

export type InvoiceImportEngine = "pdf_text" | "vlm_vision";
export type InvoiceImportKind = "pdf" | "image";

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
  engine: InvoiceImportEngine;
  importKind: InvoiceImportKind;
  warnings: string[];
};

type VlmExtractionPayload = {
  clientName: string | null;
  clientNif: string | null;
  amountBase: number | string | null;
  ivaRate: number | string | null;
  irpfRetention: number | string | null;
  totalAmount: number | string | null;
  issueDate: string | null;
  invoiceNumber?: string | null;
  series?: string | null;
  recipientEmail?: string | null;
  confidence?: number | null;
};

const VLM_EXTRACTION_PROMPT = `Eres un experto contable español especializado en analizar facturas emitidas.

Analiza el documento y devuelve SOLO un objeto JSON válido.

Importante para el esquema destino:
- clientName = nombre o razón social del CLIENTE / DESTINATARIO / receptor de la factura.
- clientNif = NIF/CIF/VAT del CLIENTE / DESTINATARIO.
- NO uses los datos del emisor salvo que no exista destinatario identificable.
- amountBase = base imponible antes de impuestos.
- ivaRate = porcentaje de IVA aplicado.
- irpfRetention = porcentaje de retención IRPF si aplica; si no aparece usa 0.
- totalAmount = importe total de la factura.
- issueDate = fecha de emisión en formato YYYY-MM-DD.
- series = serie visible si existe; si no, null.
- recipientEmail = email del cliente/destinatario si aparece; si no, null.
- confidence = confianza global de 0 a 100.

Formato exacto:
{
  "clientName": "string|null",
  "clientNif": "string|null",
  "amountBase": 0,
  "ivaRate": 21,
  "irpfRetention": 0,
  "totalAmount": 0,
  "issueDate": "YYYY-MM-DD|null",
  "invoiceNumber": "string|null",
  "series": "string|null",
  "recipientEmail": "string|null",
  "confidence": 0
}`;

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

function normalizeNif(value: string | null | undefined): string {
  if (!value) return "";
  return value.toUpperCase().replace(/[\s.-]/g, "");
}

function parseLooseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[€\s]/gi, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLooseDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return parseDateToIso(value.trim());
}

function parseJsonObject(content: string): Record<string, unknown> {
  let cleanContent = content.trim();
  const markdownMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (markdownMatch?.[1]) {
    cleanContent = markdownMatch[1].trim();
  }
  const objectMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    cleanContent = objectMatch[0];
  }
  return JSON.parse(cleanContent) as Record<string, unknown>;
}

function parseVlmExtraction(content: string, importKind: InvoiceImportKind): ParsedInvoiceImport {
  const warnings: string[] = [];

  try {
    const parsed = parseJsonObject(content) as unknown as VlmExtractionPayload;
    const clientName = parsed.clientName?.trim() ?? "";
    const clientNif = normalizeNif(parsed.clientNif);
    const amountBase = parseLooseNumber(parsed.amountBase) ?? 0;
    const ivaRate = parseLooseNumber(parsed.ivaRate) ?? 21;
    const irpfRetention = parseLooseNumber(parsed.irpfRetention) ?? 0;
    const totalAmount = parseLooseNumber(parsed.totalAmount) ?? 0;
    const issueDate = parseLooseDate(parsed.issueDate) ?? new Date().toISOString().slice(0, 10);
    const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : parseLooseNumber(parsed.confidence);
    const series = parsed.series?.trim() || issueDate.slice(0, 4);
    const recipientEmail = parsed.recipientEmail?.trim() || undefined;

    if (!clientName) warnings.push("No se pudo extraer el cliente o destinatario");
    if (!clientNif) warnings.push("No se pudo extraer el NIF/CIF del cliente");
    if (!amountBase) warnings.push("No se pudo extraer la base imponible");
    if (!totalAmount) warnings.push("No se pudo extraer el total");

    return {
      clientName,
      clientNif,
      amountBase,
      ivaRate,
      irpfRetention,
      totalAmount,
      issueDate,
      series,
      recipientEmail,
      confidence: Math.min(1, Math.max(0, (confidenceRaw ?? 50) / 100)),
      extractedText: content,
      engine: "vlm_vision",
      importKind,
      warnings,
    };
  } catch {
    throw new Error("VLM_IMPORT_PARSE_FAILED");
  }
}

function detectMimeType(fileName: string, providedMimeType?: string | null): string {
  if (providedMimeType && providedMimeType.trim().length > 0) {
    return providedMimeType;
  }

  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function ensureVlmEnabled() {
  if (!INVOICE_IMPORT_VLM_ENABLED) {
    throw new Error("VLM_IMPORT_NOT_ENABLED");
  }
}

async function createVisionClient() {
  ensureVlmEnabled();
  const module = await import("z-ai-web-dev-sdk");
  const ZAI = module.default;
  return ZAI.create();
}

async function extractWithVlm(params: {
  buffer: Buffer;
  mimeType: string;
  importKind: InvoiceImportKind;
}): Promise<ParsedInvoiceImport> {
  const client = await createVisionClient();
  const base64 = params.buffer.toString("base64");
  const imageUrl = `data:${params.mimeType};base64,${base64}`;

  const response = await client.chat.completions.createVision({
    model: ZAI_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VLM_EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  const content = response.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("VLM_EMPTY_RESPONSE");
  }

  return parseVlmExtraction(content, params.importKind);
}

function convertPdfToImageBuffer(buffer: Buffer): { buffer: Buffer; mimeType: string } {
  const workdir = mkdtempSync(path.join(tmpdir(), "anclora-invoice-import-"));
  const pdfPath = path.join(workdir, "source.pdf");
  const outputBase = path.join(workdir, "page");
  const outputPng = `${outputBase}.png`;
  const outputPpm = `${outputBase}-1.png`;

  writeFileSync(pdfPath, buffer);

  try {
    try {
      execFileSync("pdftoppm", ["-png", "-r", "180", pdfPath, outputBase], {
        cwd: workdir,
        timeout: 30000,
        stdio: "pipe",
      });
      return { buffer: readFileSync(outputPpm), mimeType: "image/png" };
    } catch {
      execFileSync("magick", ["-density", "180", `${pdfPath}[0]`, outputPng], {
        cwd: workdir,
        timeout: 30000,
        stdio: "pipe",
      });
      return { buffer: readFileSync(outputPng), mimeType: "image/png" };
    }
  } catch {
    throw new Error("PDF_TO_IMAGE_CONVERSION_FAILED");
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
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

  const clientName =
    getFieldFromLines(lines, ["cliente", "destinatario", "customer", "bill to"]) ??
    getFieldFromLines(lines, ["receptor", "recipient"]);
  const clientNif = getFieldFromLines(lines, ["nif cliente", "cif cliente", "vat cliente", "nif destinatario", "cif destinatario", "vat"]);
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

  const requiredSignals = [clientName, clientNif, issueDate, amountBase ? "1" : "", totalAmount ? "1" : ""].filter(Boolean).length;
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
    engine: "pdf_text",
    importKind: "pdf",
    warnings: [],
  };
}

export async function parseInvoiceDocument(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}): Promise<ParsedInvoiceImport> {
  const mimeType = detectMimeType(params.fileName, params.mimeType);
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("INVOICE_IMPORT_UNSUPPORTED_FILE");
  }

  if (isImage) {
    return extractWithVlm({
      buffer: params.buffer,
      mimeType,
      importKind: "image",
    });
  }

  try {
    return parseInvoicePdf(params.buffer);
  } catch (textError) {
    if (!INVOICE_IMPORT_VLM_ENABLED) {
      throw textError;
    }

    const image = convertPdfToImageBuffer(params.buffer);
    const result = await extractWithVlm({
      buffer: image.buffer,
      mimeType: image.mimeType,
      importKind: "pdf",
    });
    result.warnings = [
      "Se uso VLM sobre imagen derivada del PDF por falta de texto estructurado fiable.",
      ...result.warnings,
    ];
    return result;
  }
}

export function getInvoiceImportSource(importKind: InvoiceImportKind): "pdf_import" | "image_import" {
  return importKind === "image" ? "image_import" : "pdf_import";
}

export function buildImportedInvoicePatch(params: {
  invoice: InvoiceRecord;
  fileName: string;
  storagePath: string;
  confidence: number;
  importKind: InvoiceImportKind;
}): Partial<InvoiceRecord> {
  return {
    ...params.invoice,
    import_source: getInvoiceImportSource(params.importKind),
    import_file_name: params.fileName,
    import_storage_path: params.storagePath,
    import_confidence: params.confidence,
    imported_at: new Date().toISOString(),
  };
}
