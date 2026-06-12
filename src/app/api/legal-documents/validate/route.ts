import { NextRequest, NextResponse } from "next/server";
import { getRequestId } from "@/lib/observability/logger";
import {
  defaultLegalDocumentValidatorDependencies,
  validateLegalDocument,
} from "@/lib/legal-documents/legal-document-validator";
import type { LegalDocumentValidatorDependencies } from "@/lib/legal-documents/legal-document-validator";

function createLegalDocumentValidatePost(
  deps: LegalDocumentValidatorDependencies = defaultLegalDocumentValidatorDependencies,
) {
  return async function legalDocumentValidatePost(req: NextRequest | Request) {
    const requestId = getRequestId(req.headers.get("x-request-id"));

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", request_id: requestId },
        { status: 400 },
      );
    }

    const result = await validateLegalDocument(body, requestId, deps);
    return NextResponse.json(
      { ...result.body, request_id: requestId },
      { status: result.statusCode },
    );
  };
}

export const POST = createLegalDocumentValidatePost();
