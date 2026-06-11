import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { retrieveContext } from "@/lib/rag/retrieval";
import type { RAGChunk } from "@/lib/rag/retrieval";
import {
  buildComplianceSystemPrompt,
  buildComplianceUserPrompt,
} from "@/lib/rag/contract-compliance-prompt";
import { log, getRequestId } from "@/lib/observability/logger";
import type {
  ValidateContractRequest,
  ContractComplianceResponse,
  ContractFinding,
} from "@/types/contract-compliance";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers.get("x-request-id"));

  let body: ValidateContractRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.contract_id || !body.contract_text || !body.operation_type || !body.org_id) {
    return NextResponse.json({ error: "Missing required fields: contract_id, contract_text, operation_type, org_id" }, { status: 400 });
  }

  const { chunks } = await retrieveContext(body.contract_text.slice(0, 500), {
    category: "inmobiliario",
    limit: 8,
    threshold: 0.3,
  });

  const ragContext = chunks.map((c: RAGChunk) => c.content).join("\n\n---\n\n");

  log("info", "contract_compliance_rag_retrieved", requestId, {
    chunks_count: chunks.length,
    contract_id: body.contract_id,
    operation_type: body.operation_type,
  });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: buildComplianceSystemPrompt(),
    messages: [{ role: "user", content: buildComplianceUserPrompt(body, ragContext) }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

  let parsed: { findings: ContractFinding[]; warnings: ContractFinding[] } = {
    findings: [],
    warnings: [],
  };

  try {
    const raw = JSON.parse(rawText);
    if (raw && typeof raw === "object") {
      parsed.findings = Array.isArray(raw.findings) ? raw.findings : [];
      parsed.warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
    }
  } catch {
    log("warn", "contract_compliance_parse_error", requestId, {
      raw_preview: rawText.slice(0, 200),
    });
  }

  const blockSigning = parsed.findings.some((f) => f.block_signing);

  const response: ContractComplianceResponse = {
    contract_id: body.contract_id,
    compliance_check_passed: parsed.findings.length === 0,
    block_signing: blockSigning,
    verification_timestamp: new Date().toISOString(),
    findings: parsed.findings,
    warnings: parsed.warnings,
    rag_sources_used: chunks.length,
  };

  return NextResponse.json(response);
}
