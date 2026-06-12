import { NextRequest, NextResponse } from "next/server";
import {
  defaultContractValidatorDependencies,
  validateContractCompliance,
} from "@/lib/contracts/contract-compliance-validator";
import type { ContractValidatorDependencies } from "@/lib/contracts/contract-compliance-validator";
import { getRequestId } from "@/lib/observability/logger";

function createValidateContractPost(
  deps: ContractValidatorDependencies = defaultContractValidatorDependencies
) {
  return async function validateContractPost(req: NextRequest | Request) {
    const requestId = getRequestId(req.headers.get("x-request-id"));

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await validateContractCompliance(body, requestId, deps);
    return NextResponse.json(result.body, { status: result.statusCode });
  };
}

export const POST = createValidateContractPost();
