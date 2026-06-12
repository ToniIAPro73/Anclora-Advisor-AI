import type { NormalizedLegalDocumentValidationRequest } from "@/types/legal-document-validation";
import type { LegalDifference } from "@/types/legal-document-validation";

export function buildLegalDocumentSystemPrompt(): string {
  return `Eres un auditor legal especializado en derecho inmobiliario y contractual español
(LAU, Código Civil, Ley de Vivienda 12/2023, normativa autonómica Baleares ROAIIB Ley 3/2024,
LOPD/RGPD, legislación fiscal aplicable a inmuebles).

Recibirás:
1. El texto de un documento legal enviado para validación.
2. Diferencias detectadas automáticamente respecto a una plantilla canónica (si aplica).
3. Fragmentos de doctrina legal recuperados de la base de conocimiento.

Tu tarea: analizar el documento y emitir findings jurídicos fundamentados.

Para cada riesgo detectado devuelve un objeto JSON con:
- severity: "low", "medium", "high" o "critical"
- category: categoría jurídica o documental breve
- title: título breve del hallazgo
- description: descripción concreta del problema legal
- recommendation: acción correctora recomendada
- block_signing: true si impide la firma hasta revisión
- evidence: fragmento corto del documento o fuente que justifica el hallazgo
- source_reference: norma o artículo concreto SI Y SOLO SI aparece en el contexto recuperado

Responde ÚNICAMENTE con JSON válido siguiendo exactamente este schema:
{
  "status": "ok" | "review_required" | "error",
  "confidence": 0.0-1.0,
  "summary": "Resumen breve del análisis",
  "findings": [],
  "required_actions": [],
  "missing_clauses": []
}

Reglas obligatorias:
- Si cualquier finding tiene severity "critical", block_signing debe ser true en ese finding.
- Si el contexto normativo recuperado es insuficiente, usa status "review_required" y confidence <= 0.55.
- NO inventes artículos, sentencias o normativa que no aparezca en el contexto recuperado.
- NO incluyas disclaimer legal; lo añade el sistema automáticamente.
- source_reference SOLO si la norma está textualmente en el contexto recuperado.
- Si no detectas infracciones, responde con status "ok", findings vacío y required_actions vacío.
- No añadas ningún texto fuera del JSON.`;
}

export function buildLegalDocumentUserPrompt(
  req: NormalizedLegalDocumentValidationRequest,
  ragContext: string,
  deterministicDifferences: LegalDifference[],
): string {
  const contextBlock = ragContext.trim()
    ? `DOCTRINA LEGAL APLICABLE (recuperada de la base de conocimiento):\n${ragContext}`
    : "DOCTRINA LEGAL APLICABLE: (sin fragmentos recuperados — si esto limita el análisis, usa status \"review_required\")";

  const diffsBlock =
    deterministicDifferences.length > 0
      ? `DIFERENCIAS DETECTADAS AUTOMÁTICAMENTE (${deterministicDifferences.length}):\n` +
        deterministicDifferences
          .map(
            (d, i) =>
              `${i + 1}. [${d.severity.toUpperCase()}] ${d.type}: ${d.description}` +
              (d.canonical_value ? ` | Valor canónico: "${d.canonical_value.slice(0, 80)}"` : "") +
              (d.submitted_value ? ` | Valor enviado: "${d.submitted_value.slice(0, 80)}"` : ""),
          )
          .join("\n")
      : "DIFERENCIAS DETECTADAS AUTOMÁTICAMENTE: ninguna";

  return `TIPO DE DOCUMENTO: ${req.documentType}
JURISDICCIÓN: ${req.jurisdiction}
IDIOMA: ${req.language}
${req.documentId ? `ID DOCUMENTO: ${req.documentId}` : ""}

${contextBlock}

${diffsBlock}

TEXTO DEL DOCUMENTO A VALIDAR:
${req.documentText}`;
}
