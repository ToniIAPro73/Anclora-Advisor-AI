export interface InvoiceCalculationInput {
  amountBase: number;
  ivaRate: number;
  irpfRetention: number;
}

export interface InvoiceCalculationResult {
  amountBase: number;
  ivaRate: number;
  irpfRetention: number;
  ivaAmount: number;
  irpfAmount: number;
  totalAmount: number;
}

export interface ParsedInvoiceCalculationQuery extends InvoiceCalculationInput {
  matched: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseLocalizedNumber(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumber(query: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = query.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    const parsed = parseLocalizedNumber(raw);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function calculateInvoiceTotals(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const amountBase = round2(input.amountBase);
  const ivaRate = round2(input.ivaRate);
  const irpfRetention = round2(input.irpfRetention);
  const ivaAmount = round2((amountBase * ivaRate) / 100);
  const irpfAmount = round2((amountBase * irpfRetention) / 100);
  const totalAmount = round2(amountBase + ivaAmount - irpfAmount);

  return {
    amountBase,
    ivaRate,
    irpfRetention,
    ivaAmount,
    irpfAmount,
    totalAmount,
  };
}

export function parseInvoiceCalculationQuery(query: string): ParsedInvoiceCalculationQuery {
  const normalized = query.toLowerCase();
  const intentDetected =
    /(calcula|calcular|cuanto es|cuánto es|importe final|total factura|factura)/.test(normalized) &&
    /iva/.test(normalized) &&
    /irpf/.test(normalized);

  if (!intentDetected) {
    return { matched: false, amountBase: 0, ivaRate: 0, irpfRetention: 0 };
  }

  const amountBase = extractNumber(normalized, [
    /base(?: imponible)?(?: de)?\s+([\d.,]+)/,
    /importe(?: base)?(?: de)?\s+([\d.,]+)/,
    /factura(?: de)?\s+([\d.,]+)/,
    /([\d.,]+)\s*e(?:u)?r/,
  ]);
  const ivaRate = extractNumber(normalized, [
    /iva(?: del?)?\s+([\d.,]+)/,
    /([\d.,]+)\s*%?\s*de iva/,
  ]);
  const irpfRetention = extractNumber(normalized, [
    /irpf(?: del?)?\s+([\d.,]+)/,
    /retencion(?: de)? irpf(?: del?)?\s+([\d.,]+)/,
    /([\d.,]+)\s*%?\s*de irpf/,
  ]);

  if (amountBase === null || ivaRate === null || irpfRetention === null) {
    return { matched: false, amountBase: 0, ivaRate: 0, irpfRetention: 0 };
  }

  return {
    matched: true,
    amountBase,
    ivaRate,
    irpfRetention,
  };
}

export function formatInvoiceCalculationResponse(result: InvoiceCalculationResult): string {
  return [
    'He calculado el total de forma determinista con la formula: base + IVA - IRPF.',
    '',
    `Base imponible: ${result.amountBase.toFixed(2)} EUR`,
    `IVA (${result.ivaRate.toFixed(2)}%): ${result.ivaAmount.toFixed(2)} EUR`,
    `IRPF (${result.irpfRetention.toFixed(2)}%): ${result.irpfAmount.toFixed(2)} EUR`,
    `Total factura: ${result.totalAmount.toFixed(2)} EUR`,
  ].join('\n');
}
