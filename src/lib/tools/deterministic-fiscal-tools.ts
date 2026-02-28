import {
  calculateInvoiceTotals,
  formatInvoiceCalculationResponse,
  parseInvoiceCalculationQuery,
} from "@/lib/tools/invoice-calculator";

export type DeterministicFiscalToolName =
  | "invoice_calculator"
  | "vat_breakdown_calculator"
  | "irpf_retention_calculator"
  | "supplies_deduction_calculator"
  | "vat_prorata_calculator";

export interface DeterministicFiscalToolExecution {
  tool: DeterministicFiscalToolName;
  response: string;
  recommendations: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseLocalizedNumber(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumber(query: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = query.match(pattern);
    const raw = match?.[1];
    if (!raw) {
      continue;
    }
    const parsed = parseLocalizedNumber(raw);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function formatMoney(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function parseVatRate(query: string): number | null {
  return extractNumber(query, [
    /iva(?: del?)?\s+([\d.,]+)/,
    /([\d.,]+)\s*%?\s*de iva/,
    /tipo de iva(?: del?)?\s+([\d.,]+)/,
  ]);
}

function runInvoiceTool(query: string): DeterministicFiscalToolExecution | null {
  const parsed = parseInvoiceCalculationQuery(query);
  if (!parsed.matched) {
    return null;
  }

  const calculation = calculateInvoiceTotals(parsed);
  return {
    tool: "invoice_calculator",
    response: formatInvoiceCalculationResponse(calculation),
    recommendations: [
      "Verifica si el tipo de IVA y la retencion de IRPF aplican a tu caso concreto.",
    ],
  };
}

function runVatBreakdownTool(query: string): DeterministicFiscalToolExecution | null {
  const normalized = query.toLowerCase();
  const hasIntent =
    /iva/.test(normalized) &&
    /(calcula|calcular|cuanto|cuánto|desglosa|desglosar|total|importe|base imponible)/.test(normalized) &&
    !/irpf/.test(normalized);

  if (!hasIntent) {
    return null;
  }

  const ivaRate = parseVatRate(normalized);
  if (ivaRate === null) {
    return null;
  }

  const amountBase = extractNumber(normalized, [
    /base(?: imponible)?(?: de)?\s+([\d.,]+)/,
    /importe(?: base)?(?: de)?\s+([\d.,]+)/,
    /([\d.,]+)\s*(?:euros?|eur)?\s*(?:mas|más)\s*iva/,
  ]);

  const totalWithVat = extractNumber(normalized, [
    /total(?: con iva)?(?: de)?\s+([\d.,]+)/,
    /importe total(?: de)?\s+([\d.,]+)/,
    /con iva(?: de)?\s+([\d.,]+)/,
  ]);

  const reverseMode = /sin iva|desglosa|desglosar|base imponible/.test(normalized);

  if (amountBase !== null && !reverseMode) {
    const ivaAmount = round2((amountBase * ivaRate) / 100);
    const totalAmount = round2(amountBase + ivaAmount);
    return {
      tool: "vat_breakdown_calculator",
      response: [
        "He calculado el IVA de forma determinista sobre la base indicada.",
        "",
        `Base imponible: ${formatMoney(round2(amountBase))}`,
        `IVA (${ivaRate.toFixed(2)}%): ${formatMoney(ivaAmount)}`,
        `Total con IVA: ${formatMoney(totalAmount)}`,
      ].join("\n"),
      recommendations: [
        "Confirma si el tipo aplicable es general, reducido o superreducido.",
      ],
    };
  }

  if (totalWithVat !== null && reverseMode) {
    const amountBaseFromTotal = round2(totalWithVat / (1 + ivaRate / 100));
    const ivaAmount = round2(totalWithVat - amountBaseFromTotal);
    return {
      tool: "vat_breakdown_calculator",
      response: [
        "He desglosado el importe total para separar base imponible e IVA.",
        "",
        `Total con IVA: ${formatMoney(round2(totalWithVat))}`,
        `Base imponible: ${formatMoney(amountBaseFromTotal)}`,
        `IVA (${ivaRate.toFixed(2)}%): ${formatMoney(ivaAmount)}`,
      ].join("\n"),
      recommendations: [
        "Usa esta base imponible como referencia contable antes de registrar la factura.",
      ],
    };
  }

  return null;
}

function runIrpfRetentionTool(query: string): DeterministicFiscalToolExecution | null {
  const normalized = query.toLowerCase();
  const hasIntent =
    /irpf|retencion/.test(normalized) &&
    /(calcula|calcular|cuanto|cuánto|retencion|retención|porcentaje)/.test(normalized) &&
    !/iva/.test(normalized);

  if (!hasIntent) {
    return null;
  }

  const amountBase = extractNumber(normalized, [
    /base(?: imponible)?(?: de)?\s+([\d.,]+)/,
    /importe(?: base)?(?: de)?\s+([\d.,]+)/,
    /sobre\s+([\d.,]+)/,
    /([\d.,]+)\s*e(?:u)?r/,
  ]);
  const irpfRate = extractNumber(normalized, [
    /irpf(?: del?)?\s+([\d.,]+)/,
    /retencion(?: de)?(?: irpf)?(?: del?)?\s+([\d.,]+)/,
    /([\d.,]+)\s*%?\s*de irpf/,
  ]);

  if (amountBase === null || irpfRate === null) {
    return null;
  }

  const irpfAmount = round2((amountBase * irpfRate) / 100);
  const netAmount = round2(amountBase - irpfAmount);

  return {
    tool: "irpf_retention_calculator",
    response: [
      "He calculado la retencion de IRPF de forma determinista sobre la base indicada.",
      "",
      `Base imponible: ${formatMoney(round2(amountBase))}`,
      `IRPF (${irpfRate.toFixed(2)}%): ${formatMoney(irpfAmount)}`,
      `Importe neto tras retencion: ${formatMoney(netAmount)}`,
    ].join("\n"),
    recommendations: [
      "Valida si corresponde retencion del 7% o del 15% segun tu situacion profesional.",
    ],
  };
}

function runSuppliesDeductionTool(query: string): DeterministicFiscalToolExecution | null {
  const normalized = query.toLowerCase();
  const hasIntent =
    /(suministros|luz|agua|gas|internet)/.test(normalized) &&
    /deduc/.test(normalized);

  if (!hasIntent) {
    return null;
  }

  const squareMeterMatches = [...normalized.matchAll(/([\d.,]+)\s*m2/g)]
    .map((match) => parseLocalizedNumber(match[1] ?? ""))
    .filter((value): value is number => value !== null);

  const totalHomeMeters = squareMeterMatches[0] ?? null;
  const activityMeters = squareMeterMatches[1] ?? null;
  const expenseAmount = extractNumber(normalized, [
    /gasto(?: de)?\s+([\d.,]+)/,
    /factura(?: de)?\s+([\d.,]+)/,
    /recibo(?: de)?\s+([\d.,]+)/,
    /suministros(?: de)?\s+([\d.,]+)/,
    /sobre\s+([\d.,]+)\s*e(?:u)?r/,
  ]);

  if (
    totalHomeMeters === null ||
    activityMeters === null ||
    expenseAmount === null ||
    totalHomeMeters <= 0 ||
    activityMeters <= 0 ||
    activityMeters > totalHomeMeters
  ) {
    return null;
  }

  const activityShare = round2((activityMeters / totalHomeMeters) * 100);
  const deductibleRate = round2(activityShare * 0.3);
  const deductibleAmount = round2((expenseAmount * deductibleRate) / 100);

  return {
    tool: "supplies_deduction_calculator",
    response: [
      "He calculado la deduccion potencial de suministros con la regla 30% sobre la parte afecta.",
      "",
      `Vivienda total: ${round2(totalHomeMeters).toFixed(2)} m2`,
      `Superficie afecta: ${round2(activityMeters).toFixed(2)} m2`,
      `Porcentaje de afectacion: ${activityShare.toFixed(2)}%`,
      `Porcentaje deducible de suministros: ${deductibleRate.toFixed(2)}%`,
      `Gasto analizado: ${formatMoney(round2(expenseAmount))}`,
      `Importe potencialmente deducible: ${formatMoney(deductibleAmount)}`,
    ].join("\n"),
    recommendations: [
      "Necesitas acreditar la afectacion parcial de la vivienda y conservar las facturas de suministro.",
    ],
  };
}

function runVatProrataTool(query: string): DeterministicFiscalToolExecution | null {
  const normalized = query.toLowerCase();
  const hasIntent =
    /prorrata/.test(normalized) &&
    /iva/.test(normalized) &&
    /(deduc|soportado|calcula|calcular|cuanto|cuánto)/.test(normalized);

  if (!hasIntent) {
    return null;
  }

  const prorataRate = extractNumber(normalized, [
    /prorrata(?: del?)?\s+([\d.,]+)/,
    /([\d.,]+)\s*%?\s*de prorrata/,
  ]);
  const inputVat = extractNumber(normalized, [
    /iva(?: soportado| deducible)?(?: de)?\s+([\d.,]+)/,
    /sobre un iva(?: de)?\s+([\d.,]+)/,
    /([\d.,]+)\s*e(?:u)?r.*iva/,
  ]);

  if (prorataRate === null || inputVat === null) {
    return null;
  }

  const deductibleVat = round2((inputVat * prorataRate) / 100);
  const nonDeductibleVat = round2(inputVat - deductibleVat);

  return {
    tool: "vat_prorata_calculator",
    response: [
      "He calculado la deduccion de IVA con prorrata simple de forma determinista.",
      "",
      `IVA soportado: ${formatMoney(round2(inputVat))}`,
      `Prorrata aplicable: ${prorataRate.toFixed(2)}%`,
      `IVA deducible: ${formatMoney(deductibleVat)}`,
      `IVA no deducible: ${formatMoney(nonDeductibleVat)}`,
    ].join("\n"),
    recommendations: [
      "Confirma que la prorrata utilizada coincide con la provisional o definitiva que te corresponde.",
    ],
  };
}

export function runDeterministicFiscalTool(query: string): DeterministicFiscalToolExecution | null {
  const toolResult =
    runInvoiceTool(query) ??
    runVatBreakdownTool(query) ??
    runIrpfRetentionTool(query) ??
    runSuppliesDeductionTool(query) ??
    runVatProrataTool(query);

  return toolResult;
}
