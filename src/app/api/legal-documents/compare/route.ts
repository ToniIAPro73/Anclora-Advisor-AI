import { NextRequest, NextResponse } from "next/server";
import { getRequestId } from "@/lib/observability/logger";
import {
  normalizeLegalCompareRequest,
  compareDocuments,
} from "@/lib/legal-documents/document-diff";
import { verifyInternalLegalValidationRequest } from "@/lib/legal-documents/internal-api-security";

export function createLegalDocumentComparePost() {
  return async function legalDocumentComparePost(req: NextRequest | Request) {
    const requestId = getRequestId(req.headers.get("x-request-id"));
    const auth = verifyInternalLegalValidationRequest(req.headers, requestId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, request_id: requestId },
        { status: auth.status },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", request_id: requestId },
        { status: 400 },
      );
    }

    const raw = body as Record<string, unknown>;
    const submittedText =
      (raw.submittedText as string | undefined) ??
      (raw.submitted_text as string | undefined) ??
      "";
    const canonicalText =
      (raw.canonicalText as string | undefined) ??
      (raw.canonical_text as string | undefined) ??
      "";

    if (!submittedText.trim()) {
      return NextResponse.json(
        { error: "submittedText is required", request_id: requestId },
        { status: 400 },
      );
    }
    if (!canonicalText.trim()) {
      return NextResponse.json(
        { error: "canonicalText is required", request_id: requestId },
        { status: 400 },
      );
    }

    try {
      const normalized = normalizeLegalCompareRequest(raw);
      const result = compareDocuments(normalized);
      return NextResponse.json({ ...result, request_id: requestId });
    } catch (err) {
      console.error("[legal-documents/compare] unexpected error", {
        request_id: requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Internal server error", request_id: requestId },
        { status: 500 },
      );
    }
  };
}

export const POST = createLegalDocumentComparePost();
