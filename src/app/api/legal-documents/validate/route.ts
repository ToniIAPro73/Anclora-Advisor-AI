import { NextRequest, NextResponse } from "next/server";
import { getRequestId } from "@/lib/observability/logger";
import {
  defaultLegalDocumentValidatorDependencies,
  validateLegalDocument,
} from "@/lib/legal-documents/legal-document-validator";
import type { LegalDocumentValidatorDependencies } from "@/lib/legal-documents/legal-document-validator";
import { verifyInternalLegalValidationRequest } from "@/lib/legal-documents/internal-api-security";

export function createLegalDocumentValidatePost(
  deps: LegalDocumentValidatorDependencies = defaultLegalDocumentValidatorDependencies,
) {
  return async function legalDocumentValidatePost(req: NextRequest | Request) {
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
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const raw = body as Record<string, unknown>;
      raw.metadata = {
        ...(raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
          ? raw.metadata
          : {}),
        caller: auth.caller,
      };
    }

    const result = await validateLegalDocument(body, requestId, deps);
    return NextResponse.json(
      { ...result.body, request_id: "request_id" in result.body ? result.body.request_id : requestId },
      { status: result.statusCode },
    );
  };
}

export const POST = createLegalDocumentValidatePost();
