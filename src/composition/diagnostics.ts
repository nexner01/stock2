import { randomUUID } from "node:crypto";

import { appLogger } from "@/infrastructure/logging";

export function createDiagnosticError(
  code: string,
  message: string,
  retryable: boolean,
  cause: unknown,
) {
  const diagnosticId = randomUUID();
  appLogger.error(
    { diagnosticId, code, causeType: cause instanceof Error ? cause.name : typeof cause },
    "요청 처리에 실패했습니다.",
  );
  return { code, message, retryable, diagnosticId } as const;
}
