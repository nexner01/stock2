import { z } from "zod";

export type ProviderErrorCode =
  "timeout" | "rate_limit" | "unsupported" | "not_found" | "malformed_response";

const messages: Record<ProviderErrorCode, string> = {
  timeout: "데이터 공급원 응답 시간이 초과되었습니다.",
  rate_limit: "데이터 공급원의 요청 한도에 도달했습니다.",
  unsupported: "데이터 공급원이 이 요청을 지원하지 않습니다.",
  not_found: "데이터 공급원에서 종목 또는 데이터를 찾지 못했습니다.",
  malformed_response: "데이터 공급원 응답 형식이 올바르지 않습니다.",
};

export class MarketDataProviderError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly code: ProviderErrorCode,
    options?: ErrorOptions,
  ) {
    super(messages[code], options);
    this.name = "MarketDataProviderError";
    this.retryable = code === "timeout" || code === "rate_limit";
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

const errorStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if ("status" in error && typeof error.status === "number") return error.status;
  return null;
};

export const classifyProviderError = (
  error: unknown,
  timeoutSignalAborted = false,
): MarketDataProviderError => {
  if (error instanceof MarketDataProviderError) return error;
  if (timeoutSignalAborted || (error instanceof DOMException && error.name === "AbortError")) {
    return new MarketDataProviderError("timeout", { cause: error });
  }
  if (error instanceof z.ZodError) {
    return new MarketDataProviderError("malformed_response", { cause: error });
  }

  const status = errorStatus(error);
  const message = errorMessage(error);
  if (status === 429 || message.includes("429") || message.includes("too many requests")) {
    return new MarketDataProviderError("rate_limit", { cause: error });
  }
  if (
    status === 404 ||
    message.includes("not found") ||
    message.includes("no data found") ||
    message.includes("no fundamentals data")
  ) {
    return new MarketDataProviderError("not_found", { cause: error });
  }
  if (
    message.includes("invalid search query") ||
    message.includes("unsupported") ||
    message.includes("invalid interval")
  ) {
    return new MarketDataProviderError("unsupported", { cause: error });
  }
  return new MarketDataProviderError("malformed_response", { cause: error });
};
