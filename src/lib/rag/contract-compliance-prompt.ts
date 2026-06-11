import type { ValidateContractRequest } from "@/types/contract-compliance";

export function buildComplianceSystemPrompt(): string {
  return `Eres un auditor legal especializado en derecho inmobiliario español (LAU, Código Civil, Ley de Vivienda 12/2023, normativa Baleares ROAIIB Ley 3/2024).

Recibirás el texto de un contrato inmobiliario y fragmentos de doctrina legal relevante.
Tu tarea: detectar cláusulas que infrinjan la legislación vigente.

Para cada infracción detectada devuelve un objeto JSON con:
- clause_ref: referencia a la cláusula (número o descripción breve, máx 60 chars)
- rule: norma específica infringida (artículo y ley, máx 60 chars)
- severity: "block" si impide la firma legalmente, "warning" si requiere corrección, "info" si es recomendación
- description: descripción del problema en una frase
- suggested_fix: redacción alternativa o acción correctora en una frase
- block_signing: true solo si severity === "block"

Responde ÚNICAMENTE con JSON válido siguiendo exactamente este schema:
{
  "findings": [],
  "warnings": []
}

findings: infracciones graves (severity "block")
warnings: correcciones recomendadas y avisos (severity "warning" o "info")

Si no detectas infracciones, responde: { "findings": [], "warnings": [] }
No añadas ningún texto fuera del JSON.`;
}

export function buildComplianceUserPrompt(req: ValidateContractRequest, ragContext: string): string {
  const contextBlock = ragContext.trim()
    ? `DOCTRINA LEGAL APLICABLE:\n${ragContext}`
    : "DOCTRINA LEGAL APLICABLE: (sin fragmentos recuperados — aplica conocimiento base)";

  return `TIPO DE OPERACIÓN: ${req.operation_type}

${contextBlock}

TEXTO DEL CONTRATO A AUDITAR:
${req.contract_text}`;
}
